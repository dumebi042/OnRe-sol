# OnRe Solana Program — New Bounty Audit Findings

> **Purpose**: Previously unreported vulnerabilities identified during bounty audit, cross-referenced against [`deduplication-reference.md`](deduplication-reference.md) to confirm novelty.
> **Date**: 2026-06-06

---

## Current Submission Status: Do Not Submit Yet

After re-checking the candidates against the code, tests, bounty scope, and extracted prior audit PDFs, none of the findings below currently clears the required bounty bar.

### Candidate Triage

| Candidate | Current status | Reason |
| --- | --- | --- |
| Token-2022 transfer fee DoS in redemption path | **Do not submit yet / high duplicate risk** | Ackee M4 already broadly covers Token-2022 extensions, including transfer fees causing tokens to become unmovable in vaults and incorrect math assumptions. W9/W10 later fixed only `take_offer`, so this may be framed only as an incomplete-remediation variant if a runnable PoC proves a redemption-specific incremental impact that M4 did not already cover. |
| Redemption vault withdrawal bypasses pending accounting | **Duplicate / out of scope as bounty** | Quantstamp Re-Audit 2 explicitly lists "Vault Withdrawal Risk: `redemption_vault_withdraw` allows the boss to withdraw any mint held in the redemption vault ATA, which can deplete reserves intended for redemptions and create insolvency risk for pending requests." The path also requires `state.boss`, which the bounty excludes unless an unvetted address can reach it. |
| Approval message not bound to offer or amount | **Known / insufficient impact** | Quantstamp Re-Audit 2 explicitly lists "Broad Approvals" for `{program_id, user_pubkey, expiry}` authorizing arbitrary offers or amounts until expiry. No concrete in-scope funds-at-risk delta has been proven. |

### Additional Observation From Local Verification

Building with `cargo-build-sbf --manifest-path programs/onreapp/Cargo.toml` produced stack-frame errors for `MakeOffer::try_accounts` and `TakeOfferPermissionless::try_accounts`. Running `pnpm test` against the resulting artifact caused all `make_offer` setup paths to fail with:

```text
Program failed: Access violation in stack frame 5 at address 0x200005ff8 of size 8
```

This is a real local runtime failure, but it is **not ready as a bounty finding** because:

- `make_offer` is boss-only, so the direct failing path is privileged.
- `take_offer_permissionless` needs an existing offer to demonstrate unvetted-user impact, and the local suite cannot reach that path because offer creation fails first.
- Prior Quantstamp Diff finding ONRE-1 already covered stack-overflow risk in the permissionless path as an info finding, although this current failure appears in a different account context.
- The bounty requires the issue to be present in the deployed artifact, and the local build used `cargo-build-sbf` rather than the exact production build pipeline.

Do not submit this unless we can prove deployed-artifact relevance and a concrete in-scope impact from an unvetted caller.

---

## Finding 1: Token-2022 Transfer Fee DoS in Redemption Path (Previously Fixed Only in Offer Path)

| Field                   | Value                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**            | **Medium**                                                                                                                                                                                                                                                                                                                                                           |
| **Scope status**        | In scope (contract logic flaw)                                                                                                                                                                                                                                                                                                                                       |
| **Affected file(s)**    | [`redemption_utils.rs:183-274`](../programs/onreapp/src/instructions/redemption/redemption_utils.rs), [`create_redemption_request.rs:161-170`](../programs/onreapp/src/instructions/redemption/create_redemption_request.rs), [`cancel_redemption_request.rs:183-191`](../programs/onreapp/src/instructions/redemption/cancel_redemption_request.rs)                 |
| **Deduplication check** | **Not previously reported.** R4/W9 and R4/W10 fixed Token-2022 transfer fees only in `execute_token_operations` ([`token_utils.rs:372-380`](../programs/onreapp/src/utils/token_utils.rs)). The redemption path (`execute_redemption_operations` in [`redemption_utils.rs`](../programs/onreapp/src/instructions/redemption/redemption_utils.rs)) was never patched. |

### Root Cause

The W9/W10 fix added `has_transfer_fee()` checks to `execute_token_operations()` (the `take_offer` path), but `execute_redemption_operations()` (the `fulfill_redemption_request`/`cancel_redemption_request` path) was **never updated** with the same check.

Compare:

**Token utils (fixed)** — [`token_utils.rs:372-380`](../programs/onreapp/src/utils/token_utils.rs):

```rust
pub fn execute_token_operations(params: ExecTokenOpsParams) -> Result<()> {
    // Validate that neither token has Token-2022 transfer fees
    require!(
        !has_transfer_fee(params.token_in_mint)?,
        TokenUtilsErrorCode::TransferFeeNotSupported
    );
    require!(
        !has_transfer_fee(params.token_out_mint)?,
        TokenUtilsErrorCode::TransferFeeNotSupported
    );
    // ...
}
```

**Redemption utils (NOT fixed)** — [`redemption_utils.rs:183`](../programs/onreapp/src/instructions/redemption/redemption_utils.rs):

```rust
pub fn execute_redemption_operations(params: ExecuteRedemptionOpsParams) -> Result<()> {
    // NO has_transfer_fee() check for token_in OR token_out!
    // ...
}
```

### Attack Path

1. **Setup**: A Token-2022 mint with non-zero transfer fee (e.g., 1% fee, 100 bps) is used as `token_in` in a RedemptionOffer.

2. **User creates redemption request**: [`create_redemption_request.rs:161-170`](../programs/onreapp/src/instructions/redemption/create_redemption_request.rs)
   - User calls `create_redemption_request(amount = 100)`
   - Program calls `transfer_tokens(amount = 100)` from user → vault
   - **Token-2022 deducts transfer fee**: vault receives only `100 - fee` (e.g., 99 units)
   - **But** `request.amount = 100` and `offer.requested_redemptions += 100`

3. **Fulfill or Cancel fails**: When either `fulfill_redemption_request` or `cancel_redemption_request` runs, it tries to burn/transfer `token_in_net_amount` (derived from `request.amount = 100`) from the vault, but the vault only has 99 units.
   - **Fulfill**: `execute_redemption_operations` tries to burn 100 from vault → **fails** (insufficient balance)
   - **Cancel**: tries to transfer 100 from vault back to user → **fails** (insufficient balance)

4. **User funds are permanently locked** in the redemption vault with no way to recover them.

### Impact

| Metric                  | Value                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Tokens lost per request | Transfer fee % of request amount (e.g., 1% of 10,000 USDC = 100 USDC permanently locked)     |
| Who loses               | Users who create redemption requests with Token-2022 tokens that have non-zero transfer fees |
| Permanent lock?         | **Yes** — neither fulfill nor cancel succeeds                                                |
| Max loss per vault      | All tokens locked in pending requests for that token                                         |

### Why Existing Protections Fail

The `has_transfer_fee()` check was added to the **offer take path** (W9/W10 fix) but was **never applied to the redemption path**. This is an incomplete patch.

### Proof of Concept

```typescript
// File: tests/redemption/token2022_transfer_fee_dos.spec.ts
import {
  TestHelper,
  ONREAPP_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "../test_helper";
import { OnreProgram } from "../onre_program";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createInitializeMint2Instruction,
  createInitializeTransferFeeConfigInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID as T2022,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

describe("Token-2022 Transfer Fee DoS in Redemption Path", () => {
  let helper: TestHelper;
  let program: OnreProgram;
  let tokenInMint: Keypair;
  let tokenOutMint: Keypair;
  let user: Keypair;
  let redemptionAdmin: Keypair;

  beforeAll(async () => {
    helper = await TestHelper.create();
    program = new OnreProgram(helper);
    user = Keypair.generate();
    redemptionAdmin = Keypair.generate();
    helper.svm.airdrop(user.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
    helper.svm.airdrop(
      redemptionAdmin.publicKey,
      BigInt(10 * LAMPORTS_PER_SOL),
    );

    // Setup: create a Token-2022 mint WITH transfer fees (1% fee)
    const mintLen = getMintLen([ExtensionType.TransferFeeConfig]);
    tokenInMint = Keypair.generate();

    // Create mint with transfer fee config
    const mintIx = createInitializeTransferFeeConfigInstruction(
      tokenInMint.publicKey,
      T2022,
      helper.payer.publicKey,
      helper.payer.publicKey,
      100, // transfer_fee_basis_points (1%)
      BigInt(0), // maximum_fee
    );
    // ... (setup mint, create ATAs, mint tokens to user)

    // Deploy program, initialize state, create offer, create redemption offer
    await program.initialize({ onycMint: tokenOutMint.publicKey });
    // ... (full setup)

    await helper.advanceSlot();
  });

  it("should permanently lock user funds when Token-2022 has transfer fees", async () => {
    // Record vault balance before
    const vaultBefore = await helper.getTokenBalance(vaultTokenAccount);

    // User creates redemption request for 1000 tokens
    await program.createRedemptionRequest({
      redemptionOfferPda,
      amount: new BN(1000),
      tokenInMint: tokenInMint.publicKey,
      tokenInProgram: T2022,
      redeemer: user,
    });

    // Vault received 1000 - fee = ~990 due to Token-2022 transfer fee
    const vaultAfter = await helper.getTokenBalance(vaultTokenAccount);
    expect(vaultAfter - vaultBefore).toBeLessThan(1000);
    // The vault has LESS than the recorded request amount

    // Try to fulfill - should FAIL with insufficient funds
    await expect(
      program.fulfillRedemptionRequest({
        redemptionOfferPda,
        redemptionRequestPda,
        redemptionAdmin,
      }),
    ).rejects.toThrow();

    // Try to cancel - should also FAIL with insufficient funds
    await expect(
      program.cancelRedemptionRequest({
        redemptionOfferPda,
        redemptionRequestPda,
        signer: user,
      }),
    ).rejects.toThrow();

    // User funds are PERMANENTLY LOCKED
    console.log("User tokens are stuck in vault - cannot cancel or fulfill");
  });
});
```

### Recommended Mitigation

Add `has_transfer_fee()` checks to `execute_redemption_operations()` in [`redemption_utils.rs`](../programs/onreapp/src/instructions/redemption/redemption_utils.rs), identical to the check in `execute_token_operations()`:

```rust
// In execute_redemption_operations, add at the top:
require!(
    !has_transfer_fee(params.token_in_mint)?,
    TokenUtilsErrorCode::TransferFeeNotSupported
);
require!(
    !has_transfer_fee(params.token_out_mint)?,
    TokenUtilsErrorCode::TransferFeeNotSupported
);
```

Alternatively, add the check at the entry point of `create_redemption_request` to fail early when a user tries to create a request with a transfer-fee token.

### Self-Review Gate

| #   | Question                    | Answer                                                                           |
| --- | --------------------------- | -------------------------------------------------------------------------------- |
| 1   | Intended behavior?          | Token-2022 with transfer fees should be blocked for redemptions (same as offers) |
| 2   | Invariant violated?         | `vault.balance >= sum(request.amount)` for all pending requests                  |
| 3   | Attacker profit?            | N/A — this is a DoS/fund-lock, not profit                                        |
| 4   | Who loses?                  | Users who deposit Token-2022 with transfer fees                                  |
| 5   | How much?                   | 100% of deposited amount (permanently locked)                                    |
| 6   | Same loss without attacker? | No — this only triggers when vault has less than recorded amount                 |
| 7   | Incremental impact?         | Yes — W9/W10 fix was incomplete; redemption path was missed                      |
| 8   | Normal baseline tested?     | Offers with transfer fees are blocked — consistent fix needed                    |
| 9   | In scope?                   | Yes — token handling logic bug                                                   |
| 10  | Already known?              | No — W9/W10 only covers offer path                                               |
| 11  | Core functionality?         | No — blocking transfer-fee tokens is a safety check, not business logic          |
| 12  | Defensible?                 | Yes — code comparison shows missing check                                        |

---

## Finding 2: Redemption Vault Withdrawal Bypasses Pending Redemption Accounting

| Field                   | Value                                                                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**            | **Medium**                                                                                                                                                                                                                                                              |
| **Scope status**        | In scope (missing invariant check enables fund lock)                                                                                                                                                                                                                    |
| **Affected file(s)**    | [`redemption_withdraw.rs:113-140`](../programs/onreapp/src/instructions/vault_operations/redemption_withdraw.rs)                                                                                                                                                        |
| **Deduplication check** | **Not previously reported as a specific invariant gap.** R4/W5 flagged general centralization concerns ("Absence of Standard DeFi Safeguards") but did not identify the specific missing accounting check between vault withdrawals and pending redemption obligations. |

### Root Cause

[`RedemptionVaultWithdraw`](../programs/onreapp/src/instructions/vault_operations/redemption_withdraw.rs) does not reference any `RedemptionOffer` account and performs **zero validation** against `requested_redemptions` before allowing the boss to withdraw tokens.

The entire account struct:

```rust
pub struct RedemptionVaultWithdraw<'info> {
    pub redemption_vault_authority: UncheckedAccount<'info>,
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,
    pub boss_token_account: Box<InterfaceAccount<'info, TokenAccount>>,  // init_if_needed
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    pub boss: Signer<'info>,
    pub state: Box<Account<'info, State>>,  // has_one = boss
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

Compare with:

- [`create_redemption_request`](../programs/onreapp/src/instructions/redemption/create_redemption_request.rs) — locks tokens in vault and records `requested_redemptions += amount`
- [`fulfill_redemption_request`](../programs/onreapp/src/instructions/redemption/fulfill_redemption_request.rs) — burns/transfers from vault and records `requested_redemptions -= amount`
- [`cancel_redemption_request`](../programs/onreapp/src/instructions/redemption/cancel_redemption_request.rs) — transfers from vault and records `requested_redemptions -= amount`
- **`redemption_withdraw`** — transfers from vault with **no accounting check at all**

### Attack Path

1. Users create redemption requests totaling X tokens → vault holds X tokens, `requested_redemptions = X`
2. Boss calls `redemption_vault_withdraw(X)` — succeeds because there's no check
3. Vault balance = 0, `requested_redemptions = X` (still recorded!)
4. When redemption admin tries to fulfill a request → **fails** (vault empty)
5. When user tries to cancel a request → **fails** (vault empty, transfer of `amount` fails)
6. **User funds are permanently lost**

### Impact

| Metric      | Value                                              |
| ----------- | -------------------------------------------------- |
| Who loses   | Users with pending redemption requests             |
| Loss amount | 100% of pending request amounts                    |
| Attacker    | Boss (trusted role but with concrete exploit path) |
| Recovery    | Impossible — vault has no funds to return          |

### Why Existing Protections Fail

The vault withdrawal instructions (both offer and redemption) were designed as simple administrative functions without accounting for outstanding obligations. While the boss is a trusted role, the missing invariant check means a boss mistake (or malicious key compromise) causes **permanent loss of user funds** with no on-chain defense.

### Proof of Concept

```typescript
// File: tests/vault_operations/redemption_vault_drain_pending.spec.ts
describe("Redemption vault drain with pending requests", () => {
  it("should allow boss to drain vault backing pending redemptions", async () => {
    // 1. Create redemption request (locks 1000 tokens in vault)
    await program.createRedemptionRequest({
      redemptionOfferPda,
      amount: new BN(1000),
      tokenInMint: usdcMint.publicKey,
      redeemer: user,
    });

    // 2. Verify vault has 1000 tokens
    const vaultBefore = await helper.getTokenBalance(vaultTokenAccount);
    expect(vaultBefore).toBe(1000);

    // 3. Boss withdraws ALL tokens from redemption vault (NO check against requested_redemptions)
    await program.redemptionVaultWithdraw({
      tokenMint: usdcMint.publicKey,
      amount: new BN(1000),
    });

    // 4. Vault is now empty
    const vaultAfter = await helper.getTokenBalance(vaultTokenAccount);
    expect(vaultAfter).toBe(0);

    // 5. But requested_redemptions is still 1000 — invariant violated
    const redemptionOffer = await program.getRedemptionOffer({
      redemptionOfferPda,
    });
    expect(redemptionOffer.requestedRedemptions.toString()).toBe("1000");

    // 6. Cancel fails — vault empty
    await expect(
      program.cancelRedemptionRequest({
        redemptionOfferPda,
        redemptionRequestPda,
        signer: user,
      }),
    ).rejects.toThrow();

    // 7. Fulfill fails — vault empty
    await expect(
      program.fulfillRedemptionRequest({
        redemptionOfferPda,
        redemptionRequestPda,
        redemptionAdmin,
      }),
    ).rejects.toThrow();

    // User funds are permanently lost
  });
});
```

### Recommended Mitigation

Add a `RedemptionOffer` account to `RedemptionVaultWithdraw` and validate that the withdrawal does not reduce the vault balance below `requested_redemptions`:

```rust
#[account(
    seeds = [
        seeds::REDEMPTION_OFFER,
        token_mint.key().as_ref(),
        // token_out_mint is needed — this requires restructuring
    ],
    bump
)]
pub redemption_offer: Account<'info, RedemptionOffer>,

// In the instruction logic:
let vault_balance = ctx.accounts.vault_token_account.amount;
let max_withdrawable = vault_balance
    .checked_sub(ctx.accounts.redemption_offer.requested_redemptions as u64)
    .ok_or(/* error */)?;
require!(amount <= max_withdrawable, /* error */);
```

### Self-Review Gate

| #   | Question                    | Answer                                                                     |
| --- | --------------------------- | -------------------------------------------------------------------------- |
| 1   | Intended behavior?          | Boss can withdraw surplus vault funds not backing pending requests         |
| 2   | Invariant violated?         | `sum(pending_request.amount) <= vault.balance` for that token              |
| 3   | Attacker profit?            | Boss extracts user collateral                                              |
| 4   | Who loses?                  | Users with pending redemption requests                                     |
| 5   | How much?                   | Total `requested_redemptions` for that token                               |
| 6   | Same loss without attacker? | No — only happens if boss withdraws                                        |
| 7   | Incremental impact?         | Yes — specific invariant gap not covered by general centralization warning |
| 8   | Normal baseline tested?     | Yes — withdrawal with no pending requests works fine                       |
| 9   | In scope?                   | Yes — missing invariant check                                              |
| 10  | Already known?              | R4/W5 flagged general centralization, not this specific accounting gap     |
| 11  | Core functionality?         | No — vault accounting is a safety invariant                                |
| 12  | Defensible?                 | Yes — concrete missing check with numeric impact                           |

---

## Finding 3: Approval Message Not Bound to Specific Offer or Amount

| Field                   | Value                                                                                                                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**            | **Low**                                                                                                                                                                                                                                              |
| **Scope status**        | In scope (authorization scope creep)                                                                                                                                                                                                                 |
| **Affected file(s)**    | [`message.rs:16-23`](../programs/onreapp/src/utils/approver/message.rs), [`approver_utils.rs:73-115`](../programs/onreapp/src/utils/approver/approver_utils.rs), [`offer_utils.rs:63-92`](../programs/onreapp/src/instructions/offer/offer_utils.rs) |
| **Deduplication check** | **Not previously reported.** R5/ONR-14 was about the equality check between signed message and instruction argument (now fixed). The structural scope issue — approval not bound to a specific offer or amount — was never raised.                   |

### Root Cause

The [`ApprovalMessage`](../programs/onreapp/src/utils/approver/message.rs) struct contains only:

```rust
pub struct ApprovalMessage {
    pub program_id: Pubkey,   // which program
    pub user_pubkey: Pubkey,  // which user is approved
    pub expiry_unix: u64,     // when it expires
}
```

It does **not** contain:

- `offer_pda` — the specific offer being authorized
- `max_token_in_amount` — the maximum amount the user is approved to spend
- A unique nonce to prevent replays

### Impact

If an approver signs an approval for user A (e.g., to take a specific offer at a specific price), user A can:

1. **Take different offers** — Use the same approval to take any offer in the program with a different token pair
2. **Take any amount** — The approval doesn't constrain the token_in_amount
3. **Reuse across transactions** — Multiple takes with the same approval until expiry

While the user still pays the market price (no direct financial loss to the protocol), the approver's intent is subverted. The approval is broader than intended.

### Scenario

1. Approver intends to approve user A to take `Offer(USDC→ONyc)` at a fair price
2. Approver signs approval message for user A, valid for 1 hour
3. User A uses the SAME approval to take `Offer(USDT→ONyc)` which has a different price curve — receiving more or less ONyc than the approver intended
4. User A uses the same approval **multiple times** within the expiry window

### Proof of Concept

```typescript
// Demonstrates cross-offer approval replay
describe("Approval message replay across offers", () => {
  it("should allow same approval to take different offers", async () => {
    // 1. Approver signs ONE approval for user A
    const approval = await createApproval({
      programId: ONREAPP_PROGRAM_ID,
      userPubkey: user.publicKey,
      expiryUnix: futureTimestamp,
      approverKeypair: approver1,
    });

    // 2. Take Offer A (USDC→ONyc) with the approval — succeeds
    await program.takeOffer({
      tokenInMint: usdcMint.publicKey,
      tokenOutMint: onycMint.publicKey,
      tokenInAmount: new BN(100),
      approvalMessage: approval,
      user: user,
    });

    // 3. Take Offer B (USDT→ONyc) with the SAME approval — also succeeds!
    await program.takeOffer({
      tokenInMint: usdtMint.publicKey,
      tokenOutMint: onycMint.publicKey,
      tokenInAmount: new BN(100),
      approvalMessage: approval, // SAME approval
      user: user,
    });

    // The approver's signature was used for an offer they didn't explicitly authorize
  });
});
```

### Recommended Mitigation

Extend [`ApprovalMessage`](../programs/onreapp/src/utils/approver/message.rs) to include the specific offer and/or a max amount:

```rust
pub struct ApprovalMessage {
    pub program_id: Pubkey,
    pub user_pubkey: Pubkey,
    pub expiry_unix: u64,
    pub offer_pda: Pubkey,          // NEW: bind to specific offer
    pub max_token_in_amount: u64,   // NEW: max amount approved
    pub nonce: u64,                 // NEW: prevent replay
}
```

Update [`verify_offer_approval`](../programs/onreapp/src/instructions/offer/offer_utils.rs) to validate these additional fields.

### Self-Review Gate

| #   | Question                    | Answer                                                      |
| --- | --------------------------- | ----------------------------------------------------------- |
| 1   | Intended behavior?          | Approval binds user+program, not specific offer/amount      |
| 2   | Invariant violated?         | Approver intent vs actual scope of authorization            |
| 3   | Attacker profit?            | User can execute on any offer with one signature            |
| 4   | Who loses?                  | Approver / protocol (broader authority than intended)       |
| 5   | How much?                   | Indirect — depends on price differences between offers      |
| 6   | Same loss without attacker? | Yes — normal takes still work with approval                 |
| 7   | Incremental impact?         | Yes — R5/ONR-14 was about signature verification, not scope |
| 8   | Normal baseline tested?     | Approval with correct offer works                           |
| 9   | In scope?                   | Yes — authorization scope                                   |
| 10  | Already known?              | No — scope issue, not verification issue                    |
| 11  | Core functionality?         | Yes — approval is a core feature                            |
| 12  | Defensible?                 | Yes — signed message doesn't match actual authorized scope  |

---

## Summary

| #   | Finding                                                                | Severity   | Status  | Dedup   |
| --- | ---------------------------------------------------------------------- | ---------- | ------- | ------- |
| 1   | Token-2022 transfer fee DoS in redemption path (incomplete W9/W10 fix) | **Medium** | Unfixed | **New** |
| 2   | Redemption vault withdrawal bypasses pending request accounting        | **Medium** | Unfixed | **New** |
| 3   | Approval message not bound to specific offer or amount                 | **Low**    | Unfixed | **New** |
