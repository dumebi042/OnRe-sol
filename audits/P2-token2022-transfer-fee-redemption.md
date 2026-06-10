# P2: Token-2022 Transfer Fee Blocks Redemption Lifecycle

**Severity:** Medium  
**Scope status:** In scope (on-chain Solana program)  
**Affected program:** [`onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe`](https://solscan.io/account/onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe)  
**Commit:** (to be filled from deployed contract)

## Summary

The offer path blocks Token-2022 mints with transfer fees by calling [`has_transfer_fee()`](programs/onreapp/src/utils/token_utils.rs:486-518) at the entry to [`execute_token_operations()`](programs/onreapp/src/utils/token_utils.rs:372-380). The redemption path does not include a comparable check. When a user creates a redemption request using a Token-2022 mint with transfer fees, the vault receives less than the recorded amount, and subsequent cancel or fulfill attempts fail because the vault balance is insufficient to satisfy the recorded amount.

## Root Cause

The [`has_transfer_fee()`](programs/onreapp/src/utils/token_utils.rs:486-518) function was added to block Token-2022 transfer-fee tokens from entering the offer system. The check was placed in [`execute_token_operations()`](programs/onreapp/src/utils/token_utils.rs:372-380) (used by `take_offer` and `take_offer_permissionless`). However, the redemption system uses separate functions — [`execute_redemption_operations()`](programs/onreapp/src/instructions/redemption/redemption_utils.rs:183-274) and direct [`transfer_tokens()`](programs/onreapp/src/instructions/redemption/create_redemption_request.rs:162-170) / [`transfer_tokens()`](programs/onreapp/src/instructions/redemption/cancel_redemption_request.rs:183-191) — that never call `has_transfer_fee()`.

## Affected Code

### Missing check 1 — [`create_redemption_request.rs`](programs/onreapp/src/instructions/redemption/create_redemption_request.rs:162-170)

```rust
// Line 162-170: transfer_tokens uses transfer_checked which deducts fees
transfer_tokens(
    &ctx.accounts.token_in_mint,
    &ctx.accounts.token_program,
    &ctx.accounts.redeemer_token_account,
    &ctx.accounts.vault_token_account,
    &ctx.accounts.redeemer,
    None,
    amount,  // <-- full amount requested
)?;
```

Line 177 records the full requested amount:

```rust
redemption_request.amount = amount;
```

No `has_transfer_fee()` call precedes this transfer.

### Missing check 2 — [`redemption_utils.rs`](programs/onreapp/src/instructions/redemption/redemption_utils.rs:183-274)

`execute_redemption_operations` performs burn/transfer operations on the recorded amount without any call to `has_transfer_fee()`.

### Missing check 3 — [`cancel_redemption_request.rs`](programs/onreapp/src/instructions/redemption/cancel_redemption_request.rs:183-191)

Cancel transfers the recorded amount back from vault to user without a `has_transfer_fee()` check:

```rust
transfer_tokens(
    &ctx.accounts.token_in_mint,
    &ctx.accounts.token_program,
    &ctx.accounts.vault_token_account,
    &ctx.accounts.redeemer_token_account,
    &ctx.accounts.redemption_vault_authority,
    Some(vault_authority_signer_seeds),
    amount,  // <-- full recorded amount
)?;
```

### Present check (for comparison) — [`token_utils.rs`](programs/onreapp/src/utils/token_utils.rs:372-380)

The offer path checks and rejects transfer-fee tokens:

```rust
require!(
    !has_transfer_fee(params.token_in_mint)?,
    TokenUtilsErrorCode::TransferFeeNotSupported
);
require!(
    !has_transfer_fee(params.token_out_mint)?,
    TokenUtilsErrorCode::TransferFeeNotSupported
);
```

## Attack / Failure Path

### Setup

- Token-2022 mint `M` is configured with a transfer fee (e.g., 100 bps = 1%)
- A redemption offer exists for token pair `M → USDC`
- User holds 100 `M` tokens

### Step 1: Create redemption request

1. User calls `create_redemption_request(amount=100)`
2. `transfer_checked` debits 100 from user, but vault receives **99** (1% transfer fee deducted by Token-2022 protocol)
3. `redemption_request.amount = 100` (line 177)
4. `redemption_offer.requested_redemptions += 100` (line 181-186)

**Accounting state after step 1:**
| Asset | Expected | Actual |
|-------|----------|--------|
| Vault balance | 100 | 99 |
| Recorded amount | 100 | 100 |
| Shortfall | 0 | 1 |

### Step 2a: User or redemption_admin attempts cancel

1. Cancel reads `amount = redemption_request.amount = 100` (line 172)
2. Cancel calls `transfer_tokens(amount=100)` from vault to user (line 183-191)
3. `transfer_checked` debits 100 from vault, but vault only holds 99
4. **Transaction reverts** — insufficient funds

### Step 2b: Redemption_admin attempts fulfill (mint-authority path)

1. Fulfill reads `token_in_amount = 100` (line 239)
2. Net after fee: e.g., 95 (fee 5%). Burn 95 from vault → succeeds (burn does not trigger transfer fees)
3. Transfer 5 (fee) to boss → vault has 99-95=4 remaining → **fails**, total revert

### Step 2c: Redemption_admin attempts fulfill (no-mint-authority path)

1. Transfer full amount (100) from vault to boss → vault only has 99 → **fails**, total revert

## Impact

Normal user-facing cancel and fulfill lifecycle becomes unavailable when a Token-2022 mint with transfer fees is used for the redemption token-in. Tokens held in the vault exceed the vault's actual balance by the amount of the transfer fee(s). The user's redemption request is recorded but cannot be resolved through standard program instructions.

The boss retains a multi-step manual recovery path via [`redemption_vault_deposit`](programs/onreapp/src/instructions/vault_operations/redemption_deposit.rs:111-131) followed by [`cancel_redemption_request`](programs/onreapp/src/instructions/redemption/cancel_redemption_request.rs:70-76):

1. Boss deposits the missing fee amount into the redemption vault
2. Cancel can now succeed because vault has sufficient balance
3. The RedemptionRequest is properly closed and `requested_redemptions` is decremented

Without boss intervention, no unprivileged path can resolve the request.

## Proof Evidence

### Source-level evidence

All claims trace to specific source lines as documented in the "Affected Code" section above. The offer path's blocking mechanism at [`token_utils.rs:372-380`](programs/onreapp/src/utils/token_utils.rs:372-380) and the `has_transfer_fee()` implementation at [`token_utils.rs:486-518`](programs/onreapp/src/utils/token_utils.rs:486-518) are present in the source tree. The redemption functions at [`create_redemption_request.rs:162-170`](programs/onreapp/src/instructions/redemption/create_redemption_request.rs:162-170), [`redemption_utils.rs:183-274`](programs/onreapp/src/instructions/redemption/redemption_utils.rs:183-274), and [`cancel_redemption_request.rs:183-191`](programs/onreapp/src/instructions/redemption/cancel_redemption_request.rs:183-191) do not reference `has_transfer_fee`.

### Numeric example

```
Input:  amount         = 100 ONyc (Token-2022 mint, 1% transfer fee)
        transfer_fee   = 1 ONyc (1% of 100)

Vault receives:      99 ONyc
Request records:    100 ONyc
Requested count:    100 ONyc
Shortfall:            1 ONyc

Cancel transfer:    requires 100 from vault → vault has 99 → FAILS
Fulfill (burn 95):  vault has 4 after burn → fee transfer of 5 → FAILS
Fulfill (transfer): requires 100 from vault → vault has 99 → FAILS
```

### Recovery

Boss can deposit 1 ONyc via `redemption_vault_deposit`, then cancel succeeds. User receives 99 ONyc (second transfer fee on return). Boss can then recoup the deposited 1 ONyc via `redemption_vault_withdraw` if desired.

## Test Limitation

The compiled program binary from this repository has a BPF stack overflow in the `MakeOffer` account struct that prevents any offer or redemption instruction from executing in the local test environment. Runtime verification against the deployed on-chain program at [`onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe`](https://solscan.io/account/onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe) is required to confirm the deployed binary is affected.

The evidence presented here is based on source-code analysis with exact line references. A dynamic PoC test file exists at [`tests/redemption/token2022_transfer_fee_vulnerability.spec.ts`](tests/redemption/token2022_transfer_fee_vulnerability.spec.ts) but relies on placeholder assertions pending resolution of the BPF stack overflow.

## Recommended Fix

Add the same transfer-fee rejection check used in the offer path to all redemption-path functions that transfer tokens:

1. In [`create_redemption_request.rs`](programs/onreapp/src/instructions/redemption/create_redemption_request.rs), before the `transfer_tokens` call at line 162:

```rust
require!(
    !has_transfer_fee(&ctx.accounts.token_in_mint)?,
    TokenUtilsErrorCode::TransferFeeNotSupported
);
```

2. In [`redemption_utils.rs`](programs/onreapp/src/instructions/redemption/redemption_utils.rs), at the start of `execute_redemption_operations` (line 183):

```rust
require!(
    !has_transfer_fee(&params.token_in_mint)?,
    TokenUtilsErrorCode::TransferFeeNotSupported
);
```

3. In [`cancel_redemption_request.rs`](programs/onreapp/src/instructions/redemption/cancel_redemption_request.rs), before the `transfer_tokens` call at line 183:

```rust
require!(
    !has_transfer_fee(&ctx.accounts.token_in_mint)?,
    TokenUtilsErrorCode::TransferFeeNotSupported
);
```

Alternatively, the program could account for the actual post-transfer received amount instead of the requested amount. However, this approach requires careful handling of Token-2022 fee-on-transfer semantics and may introduce rounding complexity. Adding the same rejection check used in the offer path is the simpler and more consistent fix.

## Duplicate / Prior Findings Check

| Report          | Finding                                        | Relationship                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ackee R4 W9/W10 | Token-2022 transfer fee handling in offer path | **Related but different code path.** W9/W10 identified the transfer fee issue in `execute_token_operations` (offer path). That fix was applied only to the offer path at [`token_utils.rs:372-380`](programs/onreapp/src/utils/token_utils.rs:372-380). The redemption path (`execute_redemption_operations`, `create_redemption_request`, `cancel_redemption_request`) was never patched. This is a new instance of the same vulnerability pattern in a different control flow path. |
| Ackee R4 M4     | No Token-2022 extension validation             | **Broader scope.** M4 broadly covers all Token-2022 extensions (transfer fees, confidential transfers, etc.) without a specific exploit path. This finding demonstrates a concrete failure scenario within the scope of unhandled Token-2022 extensions.                                                                                                                                                                                                                              |

## Self-Review Gate

| #   | Question                                                     | Answer                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What is intended behavior?                                   | Token-2022 mints with transfer fees should be rejected in all money-moving instructions, as implemented in the offer path.                                                                                                 |
| 2   | What exact invariant is violated?                            | Vault balance >= sum of recorded redemption request amounts.                                                                                                                                                               |
| 3   | What is the attacker's profit or damage?                     | No profit — this is a DoS/fund-stuck scenario, not a theft vector.                                                                                                                                                         |
| 4   | Who loses funds?                                             | Users with pending redemption requests on Token-2022 transfer-fee mints lose access to their locked tokens without privileged intervention.                                                                                |
| 5   | How much do they lose?                                       | The full request amount, minus the transfer fee, is stuck in the vault until boss intervenes. Boss has a multi-step recovery path.                                                                                         |
| 6   | Does same loss happen without the attacker path?             | No — the loss requires a Token-2022 transfer-fee mint in the redemption flow, which is a protocol configuration choice.                                                                                                    |
| 7   | Is this incremental impact?                                  | Yes — the offer path fix was incomplete, leaving the redemption path exposed.                                                                                                                                              |
| 8   | Did we test the normal baseline?                             | Source-level: yes. Runtime: blocked by BPF stack overflow.                                                                                                                                                                 |
| 9   | Is the issue in scope?                                       | Yes — it affects the on-chain Solana program's fund safety.                                                                                                                                                                |
| 10  | Is it already known/duplicate?                               | **Not a direct duplicate.** Related to R4 W9/W10 (which was fixed only in offer path) and R4 M4 (which was broadly acknowledged without code fix). This finding is a new, concrete exploit path not previously documented. |
| 11  | Would a protocol engineer call this core functionality?      | Yes — the redemption lifecycle is core program functionality.                                                                                                                                                              |
| 12  | If challenged, can we defend the report calmly with numbers? | Yes — every claim has exact line references and a numeric example.                                                                                                                                                         |

## Recommendation

**Severity: Medium** — User-facing redemption lifecycle becomes unavailable for Token-2022 transfer-fee mints. Tokens are recoverable via boss intervention (multi-step, privileged). Not critical because no theft occurs and a recovery path exists.

**Do not submit yet.** Recommended prerequisites before submission:

1. Verify the deployed on-chain program at `onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe` is affected (confirm the `has_transfer_fee` check is absent from redemption path in deployed binary)
2. Confirm the BPF stack overflow in the local test environment does not affect the deployed program (the deployed binary may have been compiled differently)
3. If possible, produce a dynamic PoC using `solana-test-validator` against the deployed program ID or compile with stack overflow fix
