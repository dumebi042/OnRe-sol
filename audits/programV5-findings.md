# OnRe ProgramV5 — Bounty Audit Findings

> **Scope**: `origin/programV5` branch — unaudited new code (buffer/accrual system, configurable vaults, market stats, fee routing)
> **Date**: 2026-06-06
> **Deduplication**: None of the 5 prior audits (Quantstamp R1-R3,R5; Ackee R4) covered this code. All findings are new.

---

## Finding 1: V1 `take_offer` Bypasses Buffer Accrual and Fee Collection (High)

| Field        | Value                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------ |
| **Severity** | **High** — Direct bypass of yield/fee mechanism leading to protocol revenue loss                 |
| **Scope**    | In scope — unprivileged path exists                                                              |
| **Affected** | `take_offer` (V1) instruction in `lib.rs:290-295`, `take_offer.rs` (V1 impl), `accrue_buffer.rs` |
| **Dedup**    | **New** — buffer system did not exist during prior audits                                        |

### Root Cause

ProgramV5 registers **both** `take_offer` (V1, legacy) and `take_offer_v2` (V2, new) as independent entry points in [`lib.rs`](programs/onreapp/src/lib.rs:290-303). V2 correctly calls `accrue_buffer_from_accounts` before minting ONyc and routes fees through configurable vaults. V1 does **none** of this — it has no buffer accounts, no configurable vault accounts, and no accrual logic.

The V1 account struct (`TakeOffer`) does not include:

- `buffer_accounts: BufferAccrualAccounts<'info>` — cannot accrue the buffer
- `offer_proceeds_vault` / `offer_fee_vault` — cannot route fees correctly
- `redemption_offer` / `redemption_vault_authority` — cannot refill redemption vault

Yet V1 is **not gated** from use with ONyc offers. An attacker can call V1 to take an ONyc offer, minting ONyc **without**:

1. Accruing the buffer (management/performance fees bypassed)
2. Updating `buffer_state.previous_supply` (corrupting future accruals)
3. Routing fees to configurable vaults (fees go to boss account instead)

### Attack Path

1. Boss has deployed V5 with buffer initialized, fee config set, configurable vaults configured
2. Attacker crafts a transaction calling the V1 `take_offer` instruction (still registered in lib.rs)
3. Attacker pays USDC → receives ONyc at market price
4. `execute_token_operations` mints ONyc (program has mint authority)
5. **Buffer is never accrued** — management fee vault, performance fee vault, and reserve vault receive **zero** yield from this mint
6. **`buffer_state.previous_supply` stays stale** — next legitimate V2 call accrues buffer based on outdated supply, minting wrong amounts

### Impact

| Metric           | Value                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Revenue bypassed | Management fee % + Performance fee % of the buffer mint that SHOULD have occurred |
| State corruption | `buffer_state.previous_supply` stale → incorrect future accruals                  |
| Fee routing      | Fees go to boss (V1 path) instead of configurable fee vaults (V2 path)            |
| Repeatable       | Yes — attacker can use V1 path for every trade                                    |

### Proof of Concept

```typescript
// The deployed V5 program exposes BOTH take_offer and take_offer_v2.
// Attacker uses the V1 path for ONyc offers.

// V1 path — NO buffer accounts, NO configurable vaults
await program.methods
  .takeOffer(tokenInAmount, null) // <-- V1, NOT takeOfferV2
  .accounts({
    offer: offerPda,
    state: statePda,
    boss: bossPubkey,
    vaultAuthority: vaultAuthorityPda,
    vaultTokenInAccount: vaultTokenInAta,
    vaultTokenOutAccount: vaultTokenOutAta,
    tokenInMint: usdcMint,
    tokenInProgram: TOKEN_PROGRAM_ID,
    tokenOutMint: onycMint, // <-- ONyc offer via V1!
    tokenOutProgram: TOKEN_PROGRAM_ID,
    userTokenInAccount: userUsdcAta,
    userTokenOutAccount: userOnycAta,
    bossTokenInAccount: bossUsdcAta,
    mintAuthority: mintAuthorityPda,
    instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
    user: userKeypair.publicKey,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .signers([userKeypair])
  .rpc();

// Buffer state remains unchanged — previous_supply is stale
// Management/performance fee vaults received nothing
```

### Recommended Mitigation

Option A: Gate V1 `take_offer` from ONyc offers by adding a constraint check in the V1 handler:

```rust
require!(
    !is_onyc_token_out_mint(&ctx.accounts.state, &ctx.accounts.token_out_mint),
    crate::OnreError::UseTakeOfferV2ForOnyc
);
```

Option B: Remove V1 `take_offer` entry point entirely and migrate all callers to V2.

### Self-Review Gate

| #   | Question                    | Answer                                                                           |
| --- | --------------------------- | -------------------------------------------------------------------------------- |
| 1   | Intended behavior?          | Buffer must be accrued before any ONyc minting                                   |
| 2   | Invariant violated?         | `buffer_state.previous_supply` always reflects latest supply after any mint/burn |
| 3   | Attacker profit?            | Attacker bypasses management + performance fees on their trade                   |
| 4   | Who loses?                  | Protocol: fee vaults miss yield allocation; reserve vault under-funded           |
| 5   | Impact quantified?          | Fee % × mint amount per bypassed trade                                           |
| 6   | Same loss without attacker? | No — V2 path correctly accrues                                                   |
| 7   | Incremental impact?         | Yes — each V1 trade bypasses fees + corrupts state                               |
| 8   | Normal baseline?            | V2 correctly accrues + routes fees                                               |
| 9   | In scope?                   | Yes — unprivileged user can exploit V1 path                                      |
| 10  | Already known?              | No — buffer didn't exist during prior audits                                     |
| 11  | Core functionality?         | Yes — buffer/fee system is core to V5                                            |
| 12  | Defensible?                 | Yes — both entry points exposed, V1 has no buffer integration                    |

---

## Finding 2: Performance Fee High-Watermark Uses `>=` Allowing Fee at Unchanged NAV (Low)

| Field        | Value                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| **Severity** | **Low** — Protocol captures slightly more fees than economically justified |
| **Scope**    | In scope — systematic overcharge                                           |
| **Affected** | `accrual_utils.rs:calculate_buffer_fee_split`                              |
| **Dedup**    | **New**                                                                    |

### Root Cause

In `calculate_buffer_fee_split`, the performance fee condition uses `>=`:

```rust
// accrual_utils.rs (V5)
let performance_fee_mint_amount =
    if performance_fee_high_watermark != 0 && current_nav >= performance_fee_high_watermark {
        // charge performance fee
    } else {
        0
    };
```

The comment justifies this as intentional: "ensures performance fees apply for an interval whose stepped NAV is exactly at the stored watermark." However, this means the performance fee is charged even when NAV has **not increased** above the previous high-watermark — it's charged at the same NAV level that was already reached.

This diverges from the standard high-watermark model where fees are only charged on NAV **above** the watermark (strict `>`). With `>=`, if NAV stays flat for multiple intervals, the performance fee is applied repeatedly on the same NAV level.

### Impact

Performance fee overcharge on intervals where NAV matches the previous high-watermark exactly. Magnitude: `buffer_mint_amount_after_management * performance_fee_bps / 10000` per affected accrual.

### Recommended Mitigation

Change `>=` to `>`:

```rust
if performance_fee_high_watermark != 0 && current_nav > performance_fee_high_watermark {
```

---

## Finding 3: `delete_offer_vector` Allows Deletion of Vectors with `start_time == now` (Info)

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| **Severity** | **Info** — Minor off-by-one discrepancy |
| **Scope**    | In scope                                |
| **Affected** | `delete_offer_vector.rs` (V5)           |
| **Dedup**    | Previously noted in R5/S5 as unresolved |

### Details

In V5 `delete_offer_vector.rs`, the check uses `>`:

```rust
require!(vector_start_time > now, DeleteOfferVectorErrorCode::StartTimeInPast);
```

This means a vector with `start_time == now` cannot be deleted, even though it has not yet become "active" for any practical purpose. The R5/S5 suggestion was to use `>=`. This remains unfixed in V5.

### Recommended Mitigation

Change to `>=`:

```rust
require!(vector_start_time >= now, DeleteOfferVectorErrorCode::StartTimeInPast);
```

---

## Summary

| #   | Finding                                                        | Severity | Dedup            |
| --- | -------------------------------------------------------------- | -------- | ---------------- |
| 1   | V1 `take_offer` bypasses buffer accrual & fee collection in V5 | **High** | New              |
| 2   | Performance fee high-watermark uses `>=` instead of `>`        | Low      | New              |
| 3   | `delete_offer_vector` off-by-one (`>` should be `>=`)          | Info     | R5/S5 unresolved |
