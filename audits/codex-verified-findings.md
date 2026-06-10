# Codex Verified Findings

Findings in this file were independently checked against the current `origin/programV5` source and local tests. They do not assume previous agent notes are correct.

---

## Prop AMM Buy Bypasses Offer Approval Requirement

- **Severity:** Low. The code-level bypass is real and locally exploitable for an approval-gated Prop AMM configuration, but current mainnet state does not have any approval-gated permissionless offers or enabled Prop AMM pairs, so this should not be submitted as a live market-access bypass today.
- **Scope status:** Weak in-scope candidate as an authorization-gate bypass in a reachable protocol configuration. It is not a direct theft finding.
- **Tested commit:** `origin/programV5` at `6154228c909f188c8ab2e7f95098c77f84505bca`
- **Affected contract and function:** `programs/onreapp/src/instructions/prop_amm/buy.rs`, `open_swap_buy`
- **Root cause:** `open_swap_buy` reuses the normal offer pricing engine, but it does not call `verify_offer_approval` when the selected offer has `needs_approval = true`.

## Exact Vulnerable Logic

`open_swap_buy` checks that the offer is enabled and that permissionless mode is enabled:

```rust
let offer = ctx.accounts.offer.load()?;
offer.require_enabled()?;
require!(
    offer.allow_permissionless(),
    crate::OnreError::PermissionlessNotAllowed
);
let result = crate::instructions::offer::process_offer_core(
    &offer,
    token_in_amount,
    &ctx.accounts.token_in_mint,
    &ctx.accounts.token_out_mint,
)?;
```

The normal permissionless offer path performs the same `allow_permissionless` gate, then enforces approval:

```rust
require!(
    offer.allow_permissionless(),
    crate::OnreError::PermissionlessNotAllowed
);

verify_offer_approval(
    &offer,
    approval_message,
    program_id,
    &user.key(),
    &state.approver1,
    &state.approver2,
    instructions_sysvar,
)?;
```

The offer state defines `needs_approval` as whether taking the offer requires an approver signature. The helper `verify_offer_approval` returns `ApprovalRequired` if `needs_approval` is set and no approval is provided.

## Step-by-Step Attack Path

1. Governance creates an offer with both flags enabled:
   - `needs_approval = true`
   - `allow_permissionless = true`
2. This combination is valid and is already used by the permissionless approval tests.
3. Governance enables the Prop AMM pair for that offer.
4. An unapproved user calls `take_offer_permissionless_v2` without an approval message.
5. The normal path rejects, proving the offer is supposed to be approval-gated.
6. The same unapproved user calls `open_swap_buy` for the same offer.
7. `open_swap_buy` only checks `allow_permissionless`, skips `needs_approval`, processes the quote, and transfers or mints ONYC to the user.

## Preconditions

- The offer has `needs_approval = true`.
- The offer also has `allow_permissionless = true`.
- The Prop AMM pair is enabled for that offer.
- The attacker is any unvetted wallet with the input asset.

## Current Deployment Check

Approval-gated offers are definitely used by the program logic to restrict offer execution: `Offer.needs_approval` is documented as requiring a signature from `state.approver1` or `state.approver2`, and both normal offer-taking paths call `verify_offer_approval`.

However, approval-gated Prop AMM market access is not currently live on the queried mainnet program state. On June 6, 2026, I queried program `onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe` and found:

- Program accounts: `10`
- Offer accounts: `3`
- Active offers with `needs_approval = true` and `allow_permissionless = true`: `0`
- Active offers with those flags and an enabled Prop AMM pair PDA: `0`

All three live offers had `needsApproval=false`, `allowPermissionless=true`, and no Prop AMM pair account at the derived `prop_amm_pair` PDA.

## Impact

In a configuration where an offer is both approval-gated and Prop AMM-enabled, an unapproved user can buy ONYC through an offer that normal offer execution rejects without a trusted approver signature. This bypasses the protocol's configured approval gate for Prop AMM buys.

This does not prove direct theft because the user still pays the offer price. The concrete impact is unauthorized access to approval-gated ONYC issuance / purchase flow and loss of the approver control that the offer configuration is meant to enforce.

## Baseline Comparison

- **Normal third-party path:** `take_offer_permissionless_v2` with the same offer, same user, same amount, and no approval fails.
- **Attacker Prop AMM path:** `open_swap_buy` with the same offer, same user, same amount, and no approval succeeds.
- **Incremental delta:** the attacker receives ONYC only because the Prop AMM entry point skips the approval verifier.
- **Funds stolen?** No direct theft at tested pricing.
- **Protocol worse off than normal path?** Yes in the tested approval-gated configuration: the access restriction is bypassed. No current mainnet incremental harm was observed because no live approval-gated Prop AMM pair was found.

## Why Existing Protections Do Not Stop It

- `offer.require_enabled()` only checks whether the offer is disabled.
- `offer.allow_permissionless()` only checks whether permissionless execution is enabled.
- `process_offer_core` calculates price and amounts; it does not enforce approvals.
- `verify_offer_approval` is not called anywhere in `open_swap_buy`.
- `minimum_out` protects the buyer from bad execution, not the protocol's approval gate.

## Proof of Concept

Local execution environment: Rust/LiteSVM tests. Hardhat/Foundry are not applicable because this is a Solana Anchor program, not an EVM program.

Setup:

```bash
git checkout origin/programV5
pnpm install
cargo-build-sbf --manifest-path programs/onreapp/Cargo.toml
```

Add this test to `programs/onreapp/tests/prop_amm.rs`:

```rust
#[test]
fn test_open_swap_buy_bypasses_offer_approval_requirement() {
    let mut ctx = setup_prop_amm_with_offer_flags(true, true);
    let boss = ctx.payer.pubkey();
    add_prop_amm_vector(&mut ctx);

    let token_in_amount = 1_000_000;
    let normal_permissionless_ix = build_take_offer_permissionless_v2_ix(
        &ctx.user.pubkey(),
        &boss,
        &ctx.usdc_mint,
        &ctx.onyc_mint,
        token_in_amount,
        None,
        &TOKEN_PROGRAM_ID,
        &TOKEN_PROGRAM_ID,
    );
    let normal_result = send_tx(
        &mut ctx.svm,
        &[normal_permissionless_ix],
        &[&ctx.payer, &ctx.user],
    );
    assert!(
        normal_result.is_err(),
        "normal permissionless offer execution must require an approval"
    );

    let prop_amm_buy_ix = build_open_swap_buy_ix(
        &ctx.onyc_mint,
        &ctx.user.pubkey(),
        &boss,
        &ctx.usdc_mint,
        &ctx.onyc_mint,
        token_in_amount,
        0,
        &TOKEN_PROGRAM_ID,
        &TOKEN_PROGRAM_ID,
    );
    send_tx(&mut ctx.svm, &[prop_amm_buy_ix], &[&ctx.payer, &ctx.user])
        .expect("Prop AMM buy unexpectedly enforced offer approval");

    let user_onyc = get_token_balance(
        &ctx.svm,
        &get_associated_token_address(&ctx.user.pubkey(), &ctx.onyc_mint),
    );
    assert!(
        user_onyc > 0,
        "unapproved user received ONyc through Prop AMM buy"
    );
}
```

Run:

```bash
cargo test -p onreapp test_open_swap_buy_bypasses_offer_approval_requirement -- --nocapture
```

Observed result:

```text
test test_open_swap_buy_bypasses_offer_approval_requirement ... ok
```

## Expected Result vs Actual Result

- **Expected:** `open_swap_buy` should reject without an approval message when the underlying offer has `needs_approval = true`, matching `take_offer_permissionless_v2`.
- **Actual:** `open_swap_buy` succeeds and the unapproved user receives ONYC.

## Recommended Mitigation

Thread the optional approval message into `open_swap_buy` and call `verify_offer_approval` before `process_offer_core` when the offer is loaded. If Prop AMM buys are intentionally never approval-gated, reject Prop AMM configuration for `needs_approval = true` offers so the two modes cannot be combined ambiguously.

## Self-Review Gate

| # | Question | Answer |
| --- | --- | --- |
| 1 | Intended behavior? | `needs_approval` means taking the offer requires an approver signature. |
| 2 | Exact invariant violated? | Every execution path that takes an approval-gated offer must enforce `verify_offer_approval`. |
| 3 | Attacker profit or damage? | Unauthorized ONYC purchase through a restricted offer in the tested configuration; no direct theft shown. |
| 4 | Who loses funds? | No direct fund loss at tested price. The protocol loses approval-gated access control. |
| 5 | How much do they lose? | Not quantifiable as stolen funds; impact is authorization bypass. |
| 6 | Same loss without attacker path? | No. Normal permissionless execution rejects without approval. |
| 7 | Incremental impact? | Yes. The bypass exists only through `open_swap_buy`. |
| 8 | Normal baseline tested? | Yes. `take_offer_permissionless_v2` fails in the same setup. |
| 9 | In scope? | Weak candidate only. It is a real authorization bypass in a reachable configuration, but not currently live on queried mainnet state. |
| 10 | Already known or duplicate? | Search found prior approval-scope/approver issues, but not missing Prop AMM approval enforcement. |
| 11 | Core functionality? | Yes. Approval mode and Prop AMM buys are primary protocol flows. |
| 12 | Defensible with numbers? | Defensible as a local access-control delta. The live-state query found `0` currently affected approval-gated Prop AMM offers, so do not present it as current direct loss. |
