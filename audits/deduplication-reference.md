# OnRe Solana Program — Cross-Report Audit Findings & Deduplication Reference

> **Purpose**: Cross-reference all 5 prior security audit reports to avoid reporting duplicate findings during the bounty audit.
> **Generated**: 2026-06-06

---

## Report Index

| #      | Report Title                                                                                                          | Auditor              | Timeline                | Findings           | High | Med | Low | Info/Warn     |
| ------ | --------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------- | ------------------ | ---- | --- | --- | ------------- |
| **R1** | [Nayms - OnRe Offer/Redemption Program Spec](./Nayms%20-%20OnRe%20Offer_Redemption%20Program%20Spec%20-%20Report.pdf) | **Quantstamp**       | 2025-03-20 → 2025-03-28 | 6 + 6 suggestions  | 0    | 0   | 3   | 3             |
| **R2** | [OnRe Solana](./OnRe%20Solana%20-%20Report.pdf)                                                                       | **Quantstamp**       | 2025-05-15 → 2025-05-19 | 5 + 6 suggestions  | 1    | 1   | 3   | 0             |
| **R3** | [OnRe Solana Diff](./OnRe%20Solana%20Diff%20-%20Report.pdf)                                                           | **Quantstamp**       | 2025-08-25 → 2025-08-26 | 1 + 3 suggestions  | 0    | 0   | 0   | 1             |
| **R4** | [Onre: Tokenized (re)Insurance Pools](./ackee-blockchain-onre-onre-report.pdf)                                        | **Ackee Blockchain** | 2025-10-15 → 2025-11-25 | 15 (2 in rev 1.1)  | 0    | 4   | 2   | 9 (Warn+Info) |
| **R5** | [Onre - Re-Audit - 2](./Onre%20-%20Re-Audit%20-%202%20-%20Report.pdf)                                                 | **Quantstamp**       | 2025-12-09 → 2025-12-20 | 15 + 5 suggestions | 1    | 3   | 5   | 6             |

---

## Report 1: Nayms - OnRe Offer/Redemption Program Spec (Quantstamp)

- **Auditors**: Paul Clemson, Mostafa Yassin, István Böhm
- **Commit**: `#a4ab643`
- **Total**: 6 findings (3 Low, 3 Info) + 6 Suggestions

### Findings

| ID     | Title                                      | Severity | Status           | Files           | Description                                                                                                                                  |
| ------ | ------------------------------------------ | -------- | ---------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ONRE-1 | Initialization Can Be Frontrun             | Low      | **Mitigated**    | `initialize.rs` | Attacker can create state and set themselves as boss before deployer. Mitigated by adding error detection, but front-running still possible. |
| ONRE-2 | Lack of Public Key Validation              | Low      | **Fixed**        | `set_boss.rs`   | `set_boss()` doesn't validate `new_boss != Pubkey::default()`, allowing reset to default pubkey.                                             |
| ONRE-3 | Uniqueness of offer_id Not Enforced        | Low      | **Acknowledged** | `make_offer.rs` | No on-chain enforcement of unique offer IDs; reuse after close can cause confusion. Off-chain application handles uniqueness.                |
| ONRE-4 | Potential Loss of Precision (9→6 decimals) | Info     | **Acknowledged** | `take_offer.rs` | Precision loss when trading tokens with different decimals (ONe/rONe=9, USDC=6).                                                             |
| ONRE-5 | Lack of Error Reporting During Init        | Info     | **Fixed**        | `initialize.rs` | No error returned if `state.boss` already set, making re-init detection harder.                                                              |
| ONRE-6 | Missing Buy Token Amount Validation        | Info     | **Fixed**        | `take_offer.rs` | `calculate_buy_amount()` doesn't error on zero amount from truncation.                                                                       |

### Suggestions

| ID  | Title                                                                               | Status       | Files           |
| --- | ----------------------------------------------------------------------------------- | ------------ | --------------- |
| S1  | Lack of Pause Functionality                                                         | Acknowledged | —               |
| S2  | Critical Role Transfer Not Following Two-Step Pattern                               | Acknowledged | `set_boss.rs`   |
| S3  | Lack of Offer Active Status Validation                                              | Acknowledged | `take_offer.rs` |
| S4  | Lack of Token Total Amount Validation                                               | **Fixed**    | `make_offer.rs` |
| S5  | Unchecked Arithmetic Operations                                                     | **Fixed**    | `take_offer.rs` |
| S6  | Add Constraint to Ensure TakeOfferTwo Struct Cannot Be Used for Single-Token Offers | **Fixed**    | `take_offer.rs` |

---

## Report 2: OnRe Solana (Quantstamp)

- **Auditors**: Paul Clemson, Darren Jensen, István Böhm
- **Commit**: `#6aba335`
- **Total**: 5 findings (1 High, 1 Med, 3 Low) + 6 Suggestions

### Findings

| ID     | Title                                           | Severity   | Status           | Files            | Description                                                                                            |
| ------ | ----------------------------------------------- | ---------- | ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| ONRE-1 | Improper Price Calculation Leads to Overpayment | **High**   | **Fixed**        | `take_offer.rs`  | Partial intervals at end of offer period cause users to pay one interval more than intended max price. |
| ONRE-2 | Missing mut on boss Signer in CloseOfferTwo     | **Medium** | **Fixed**        | `close_offer.rs` | Boss not marked `#[account(mut)]` so rent refunds from closing accounts may fail.                      |
| ONRE-3 | Lack of Slippage Protection                     | Low        | **Acknowledged** | `take_offer.rs`  | No minimum output amount, users vulnerable to interval-boundary price changes.                         |
| ONRE-4 | Improper Values in Event Emission               | Low        | **Fixed**        | `take_offer.rs`  | `remaining_sell_token_amount` in events calculated incorrectly.                                        |
| ONRE-5 | Initialization Can Be Frontrun                  | Low        | **Acknowledged** | `initialize.rs`  | Same as R1/ONRE-1; team acknowledges and relies on Squads + check.                                     |

### Suggestions

| ID  | Title                                                      | Status        | Files                          |
| --- | ---------------------------------------------------------- | ------------- | ------------------------------ |
| S1  | Unnecessary mut on Signer Accounts                         | **Fixed**     | `set_boss.rs`, `take_offer.rs` |
| S2  | Critical Role Transfer Not Following Two-Step Pattern      | Acknowledged  | `set_boss.rs`                  |
| S3  | Missing Validation of Buy Tokens in close_offer_two()      | **Fixed**     | `close_offer.rs`               |
| S4  | Code Duplication Increases Maintenance Overhead            | **Mitigated** | `make_offer.rs`                |
| S5  | Missing Minimum Offer Duration Validation                  | Acknowledged  | `make_offer.rs`                |
| S6  | Code Improvements (comments, error codes, CHECK directive) | **Mitigated** | various                        |

---

## Report 3: OnRe Solana Diff (Quantstamp)

- **Auditors**: Darren Jensen, Hamed Mohammadi, Paul Clemson
- **Commit**: `#ce75db1`
- **Scope**: Diff audit of permissionless account + `take_offer_one_permissionless`
- **Total**: 1 finding (Info) + 3 Suggestions

### Findings

| ID     | Title                                        | Severity | Status    | Files                              | Description                                                                                              |
| ------ | -------------------------------------------- | -------- | --------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ONRE-1 | Unboxed Accounts May Trigger Stack Overflows | Info     | **Fixed** | `take_offer_one_permissionless.rs` | Large account structs on stack exceed per-frame limits; fixed with `Box<Account>` and `token_interface`. |

### Suggestions

| ID  | Title                                                | Status       | Files                              |
| --- | ---------------------------------------------------- | ------------ | ---------------------------------- |
| S1  | Missing Input Validation (empty name, missing event) | **Fixed**    | `initialize.rs`                    |
| S2  | Missing Documentation                                | **Fixed**    | `lib.rs`                           |
| S3  | Code Duplication (identical calculate functions)     | Acknowledged | `take_offer_one_permissionless.rs` |

### Known Remaining Issues

- S3 acknowledged; code duplication deferred to new program version.

---

## Report 4: Onre — Tokenized (re)Insurance Pools (Ackee Blockchain)

- **Auditors**: Andrej Lukačovič (Lead), Felipe Donato, Josef Gattermayer (Supervisor)
- **Commits**: `#27e9fe7` (rev 1.0), `#233b005` (rev 1.1), `#8b5b78e` (rev 1.2)
- **Total**: 15 findings (0 Critical, 0 High, 4 Medium, 2 Low, 8 Warning, 1 Info)

### Findings (Revision 1.0)

| ID  | Title                                                                  | Severity   | Status              | Files                         | Description                                                                                                                     |
| --- | ---------------------------------------------------------------------- | ---------- | ------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Missing token_program constraint prevents Token-2022 vault withdrawals | **Medium** | **Fixed**           | `offer_withdraw.rs`           | Withdrawal constraint defaults to legacy SPL Token, fails for Token-2022 vaults.                                                |
| M2  | Global Approver Key Rotation causes system-wide approval lockout       | **Medium** | **Partially Fixed** | `approver_utils.rs`           | Changing approver invalidates all existing approvals. Fixed to 2-approver system, but removing both and re-adding still breaks. |
| M3  | Boss Unbounded ONyc Token Minting                                      | **Medium** | **Fixed**           | `mint_to.rs`                  | Added `max_supply` cap. However, setting to 0 removes the cap.                                                                  |
| M4  | Token-2022 allowed but no validation for its extensions                | **Medium** | **Acknowledged**    | various                       | Permanent delegate, transfer fee, freeze authority extensions not checked.                                                      |
| L1  | Unsafe Single-Step Ownership Transfer                                  | Low        | **Fixed**           | `set_boss.rs`                 | Two-step propose+accept pattern implemented.                                                                                    |
| L2  | Boss role hijack via Initialize call frontrun                          | Low        | **Fixed**           | `initialize.rs`               | Upgrade authority check implemented to restrict initializer.                                                                    |
| W1  | Inconsistent APY-take_offer model                                      | Warning    | **Acknowledged**    | `get_apy.rs`, `take_offer.rs` | `get_apy` shows compound but `calculate_vector_price` is linear.                                                                |
| W2  | Vector Addition Blocked Due to Incorrect Validation                    | Warning    | **Fixed**           | `add_offer_vector.rs`         | Validated `base_time` instead of computed `start_time`.                                                                         |
| W3  | Fees Are Burned Instead of Being Collected                             | Warning    | **Fixed**           | `token_utils.rs`              | Fee portion burned in burn/mint path instead of sent to boss.                                                                   |
| W4  | Backdated Vector Price                                                 | Warning    | **Acknowledged**    | `add_offer_vector.rs`         | Boss can set past `base_time` for retroactive APR growth. Design feature.                                                       |
| W5  | Centralization and Absence of Standard DeFi Safeguards                 | Warning    | **Partially Fixed** | various                       | Max supply caps + events added. No on-chain multisig enforcement.                                                               |
| W6  | Vector Cleanup Executes After Empty Slot Check                         | Warning    | **Fixed**           | `add_offer_vector.rs`         | Cleanup runs after finding empty slot, causing false "TooManyVectors" errors.                                                   |
| W7  | Deleting Active Single Vector Causes DoS                               | Warning    | **Fixed**           | `delete_offer_vector.rs`      | Deleting the only active vector makes `take_offer` fail.                                                                        |
| W8  | Immediate Fee Changes Enable TOCTOU Attacks                            | Warning    | **Acknowledged**    | `update_offer_fee.rs`         | Fee changes apply immediately; no timelock or slippage.                                                                         |
| I1  | Unnecessary code logic                                                 | Info       | **Fixed**           | various                       | Removed bump seed storage, unnecessary `mut` flags, unused `MAX_OFFERS` constant.                                               |

### Findings (Revision 1.1)

| ID  | Title                                                         | Severity | Status    | Files           | Description                                                                                                       |
| --- | ------------------------------------------------------------- | -------- | --------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| W9  | Token-2022 Transfer Fee Causes User to Receive Less token_out | Warning  | **Fixed** | `take_offer.rs` | Transfer fees not accounted for when program lacks mint authority. Fixed by blocking non-zero transfer fee mints. |
| W10 | Token-2022 Transfer Fee on token_in Breaks Burn Path (DoS)    | Warning  | **Fixed** | `take_offer.rs` | Transfer fees cause burn to fail. Fixed by blocking non-zero transfer fee mints.                                  |

### Known Remaining Issues

- **M2**: Partial fix — removing both approvers and adding new ones still breaks approvals.
- **M4**: Token-2022 extension validation is acknowledged but not implemented on-chain.
- **W4**: Backdated vectors are a design feature; no bounds on historical `base_time`.
- **W8**: Fee TOCTOU acknowledged; no timelock/slippage implemented.
- **W9/W10 fix side-effect**: If a token's transfer fee increases from 0 to non-zero, all existing offers using that token will DoS (cannot `take_offer`). Client acknowledged.

---

## Report 5: Onre - Re-Audit - 2 (Quantstamp)

- **Auditors**: Hamed Mohammadi, Darren Jensen, Paul Clemson
- **Commit**: `#b909c7f`
- **Total**: 15 findings (1 High, 3 Med, 5 Low, 6 Info) + 5 Suggestions

### Findings

| ID     | Title                                                            | Severity   | Status           | Files                                                           | Description                                                                                              |
| ------ | ---------------------------------------------------------------- | ---------- | ---------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ONR-1  | Missing Association Checks Between Redemption Offer and Request  | **High**   | **Fixed**        | `cancel_redemption_request.rs`                                  | No validation that request belongs to the offer, enabling state corruption via cross-offer manipulation. |
| ONR-2  | DoS Risk Due to Inaccessible Mint Authority                      | **Medium** | **Acknowledged** | `transfer_mint_authority_to_program.rs`                         | Boss transfer without updating mint authorities can permanently block mint/burn.                         |
| ONR-3  | RedemptionOffer.requested_redemptions Not Updated on Fulfillment | **Medium** | **Fixed**        | `fulfill_redemption_request.rs`                                 | Field not decremented when request fulfilled.                                                            |
| ONR-4  | Consider Enforcing PDA Constraint Validation                     | **Medium** | **Fixed**        | `redemption/*`                                                  | Missing PDA seed re-validation for redemption accounts across instructions.                              |
| ONR-5  | Missing Slippage Protection                                      | Low        | **Acknowledged** | `take_offer.rs`, `create_redemption_request.rs`                 | No minimum output amount specified; same class as R2/ONRE-3.                                             |
| ONR-6  | Fee Can Be Increased While User Request Active                   | Low        | **Acknowledged** | `fulfill_redemption_request.rs`                                 | Fee calculated at fulfillment time, not request time.                                                    |
| ONR-7  | Ensure Distinct Accounts for Approver Roles                      | Low        | **Fixed**        | `add_approver.rs`, `remove_approver.rs`                         | No duplicate approver check in `add_approver()`.                                                         |
| ONR-8  | Redemption Requests for Closed Offers                            | Low        | **Fixed**        | `create_redemption_request.rs`                                  | Request can be created for offer tied to a closed Offer. Fixed by removing `close_offer` entirely.       |
| ONR-9  | Permissionless Initialization on Immutable Deployments           | Low        | **Acknowledged** | `initialize.rs`                                                 | If program is immutable, any first caller can seize boss role (upgrade authority = None).                |
| ONR-10 | Kill Switch Not Enforced in Minting                              | Info       | **Acknowledged** | `mint_to.rs`                                                    | `mint_to` bypasses kill switch; boss can mint during emergency pause.                                    |
| ONR-11 | Statelessness Check for Ed25519 Program                          | Info       | **Fixed**        | `approver_utils.rs`                                             | Missing check that Ed25519 instruction has no accounts.                                                  |
| ONR-12 | RedemptionRequest Accounts Should Be Closed                      | Info       | **Fixed**        | `cancel_redemption_request.rs`, `fulfill_redemption_request.rs` | Accounts not closed after fulfillment/cancellation.                                                      |
| ONR-13 | Floor Division During Fee Calculations                           | Info       | **Fixed**        | `token_utils.rs`                                                | Changed from floor to ceiling division.                                                                  |
| ONR-14 | Approval Message Not Strictly Bound to Signed Payload            | Info       | **Fixed**        | `approver_utils.rs`                                             | No equality check between signed message and instruction argument.                                       |
| ONR-15 | Redundant expires_at Parameter                                   | Info       | **Fixed**        | `create_redemption_request.rs`                                  | Removed; Solana's blockhash replay protection suffices.                                                  |

### Suggestions

| ID  | Title                                                  | Status        | Files               |
| --- | ------------------------------------------------------ | ------------- | ------------------- |
| S1  | Use UncheckedAccount instead of AccountInfo            | **Mitigated** | various             |
| S2  | Assign Default Value to State.redemption_admin         | **Fixed**     | `initialize.rs`     |
| S3  | Properly Validate Ed25519 Program Data                 | **Fixed**     | `ed25519_parser.rs` |
| S4  | Code Improvements (comments, constraints, error codes) | **Mitigated** | various             |
| S5  | Missing Validation (various functions)                 | **Mitigated** | various             |

### Known Remaining Issues from S5

- `delete_offer_vector.rs`: validation `vector_start_time > now` should be `>= now`
- `set_redemption_admin.rs`: missing `Pubkey::default()` check
- `redemption_withdraw.rs`: `boss_token_account` not marked mutable despite receiving transfers

---

## Deduplication Reference — By Finding Category

### 1. INITIALIZATION / FRONTRUNNING

| Detail                                                                  | Severity | Reports                                       | Status                                                 |
| ----------------------------------------------------------------------- | -------- | --------------------------------------------- | ------------------------------------------------------ |
| Initialization can be frontrun — attacker sets boss before deployer     | **Low**  | **R1** (ONRE-1), **R2** (ONRE-5), **R4** (L2) | **R1**: Mitigated, **R2**: Acknowledged, **R4**: Fixed |
| Permissionless init on immutable deployments — first caller seizes boss | **Low**  | **R5** (ONR-9)                                | Acknowledged                                           |
| Lack of Error Reporting During Init (no error if boss already set)      | Info     | **R1** (ONRE-5)                               | Fixed                                                  |

### 2. ACCESS CONTROL / OWNERSHIP / RBAC

| Detail                                                     | Severity    | Reports                               | Status                                  |
| ---------------------------------------------------------- | ----------- | ------------------------------------- | --------------------------------------- |
| Single-step ownership transfer (no propose/accept)         | Low–Warning | **R1** (S2), **R2** (S2), **R4** (L1) | **R1**: Ack, **R2**: Ack, **R4**: Fixed |
| Lack of Public Key Validation (Pubkey::default())          | Low         | **R1** (ONRE-2)                       | Fixed                                   |
| Missing mut on boss Signer in CloseOfferTwo                | Medium      | **R2** (ONRE-2)                       | Fixed                                   |
| Unnecessary mut on Signer accounts                         | Suggestion  | **R2** (S1)                           | Fixed                                   |
| Boss Unbounded ONyc Token Minting (no supply cap)          | Medium      | **R4** (M3)                           | Fixed                                   |
| Kill Switch Not Enforced in Minting                        | Info        | **R5** (ONR-10)                       | Acknowledged                            |
| Distinct accounts for Approver roles not enforced          | Low         | **R5** (ONR-7)                        | Fixed                                   |
| DoS Risk — Inaccessible Mint Authority after boss transfer | Medium      | **R5** (ONR-2)                        | Acknowledged                            |
| Centralization — Absence of Standard DeFi Safeguards       | Warning     | **R4** (W5)                           | Partially Fixed                         |
| Missing Validation of Buy Tokens in close_offer_two        | Suggestion  | **R2** (S3)                           | Fixed                                   |

### 3. PRICING / ARITHMETIC / PRECISION

| Detail                                                        | Severity   | Reports         | Status       |
| ------------------------------------------------------------- | ---------- | --------------- | ------------ |
| Improper Price Calculation — overpayment on partial intervals | **High**   | **R2** (ONRE-1) | Fixed        |
| Precision Loss when Trading 9→6 Decimals                      | Info       | **R1** (ONRE-4) | Acknowledged |
| Missing Buy Token Amount Validation (zero from truncation)    | Info       | **R1** (ONRE-6) | Fixed        |
| Floor Division During Fee Calculations                        | Info       | **R5** (ONR-13) | Fixed        |
| Unchecked Arithmetic Operations                               | Suggestion | **R1** (S5)     | Fixed        |
| Inconsistent APY-take_offer model                             | Warning    | **R4** (W1)     | Acknowledged |
| Fees Burned Instead of Collected                              | Warning    | **R4** (W3)     | Fixed        |
| Immediate Fee Changes Enable TOCTOU                           | Warning    | **R4** (W8)     | Acknowledged |
| Fee Can Be Increased While User Request Active                | Low        | **R5** (ONR-6)  | Acknowledged |

### 4. SLIPPAGE / TOCTOU / USER PROTECTION

| Detail                                                     | Severity   | Reports                         | Status            |
| ---------------------------------------------------------- | ---------- | ------------------------------- | ----------------- |
| Lack of Slippage Protection — unfavorable execution prices | **Low**    | **R2** (ONRE-3), **R5** (ONR-5) | Both Acknowledged |
| Lack of Pause Functionality                                | Suggestion | **R1** (S1)                     | Acknowledged      |

### 5. OFFER / VECTOR LOGIC

| Detail                                                   | Severity   | Reports         | Status       |
| -------------------------------------------------------- | ---------- | --------------- | ------------ |
| Uniqueness of offer_id Not Enforced                      | Low        | **R1** (ONRE-3) | Acknowledged |
| Missing Token Total Amount Validation (zero amounts)     | Suggestion | **R1** (S4)     | Fixed        |
| Lack of Offer Active Status Validation                   | Suggestion | **R1** (S3)     | Acknowledged |
| Missing Minimum Offer Duration Validation                | Suggestion | **R2** (S5)     | Acknowledged |
| Vector Addition Blocked Due to Incorrect Validation      | Warning    | **R4** (W2)     | Fixed        |
| Backdated Vector Price (retroactive APR)                 | Warning    | **R4** (W4)     | Acknowledged |
| Vector Cleanup Executes After Empty Slot Check           | Warning    | **R4** (W6)     | Fixed        |
| Deleting Active Single Vector Causes DoS                 | Warning    | **R4** (W7)     | Fixed        |
| Code Duplication (make_offer_one/make_offer_two)         | Suggestion | **R2** (S4)     | Mitigated    |
| Missing TakeOfferTwo constraint for 2-token offer        | Suggestion | **R1** (S6)     | Fixed        |
| Code Duplication (calculate functions in permissionless) | Suggestion | **R3** (S3)     | Acknowledged |

### 6. REDEMPTION SYSTEM

| Detail                                                          | Severity   | Reports         | Status |
| --------------------------------------------------------------- | ---------- | --------------- | ------ |
| Missing Association Checks Between Redemption Offer and Request | **High**   | **R5** (ONR-1)  | Fixed  |
| request_redemptions Not Updated on Fulfillment                  | **Medium** | **R5** (ONR-3)  | Fixed  |
| Enforce PDA Constraint Validation                               | **Medium** | **R5** (ONR-4)  | Fixed  |
| Redemption Requests for Closed Offers                           | Low        | **R5** (ONR-8)  | Fixed  |
| RedemptionRequest Accounts Should Be Closed                     | Info       | **R5** (ONR-12) | Fixed  |
| Redundant expires_at Parameter                                  | Info       | **R5** (ONR-15) | Fixed  |

### 7. TOKEN-2022 COMPATIBILITY

| Detail                                                     | Severity   | Reports         | Status       |
| ---------------------------------------------------------- | ---------- | --------------- | ------------ |
| Missing token_program constraint (vault withdrawals fail)  | **Medium** | **R4** (M1)     | Fixed        |
| Token-2022 allowed but no extension validation             | **Medium** | **R4** (M4)     | Acknowledged |
| Token-2022 Transfer Fee — user receives less token_out     | Warning    | **R4** (W9)     | Fixed        |
| Token-2022 Transfer Fee on token_in breaks burn path (DoS) | Warning    | **R4** (W10)    | Fixed        |
| Unboxed Accounts May Trigger Stack Overflows               | Info       | **R3** (ONRE-1) | Fixed        |

### 8. INPUT VALIDATION / DEFENSE-IN-DEPTH

| Detail                                                       | Severity   | Reports                  | Status    |
| ------------------------------------------------------------ | ---------- | ------------------------ | --------- |
| Approval Message Not Strictly Bound to Signed Payload        | Info       | **R5** (ONR-14)          | Fixed     |
| Statelessness Check for Ed25519 Program                      | Info       | **R5** (ONR-11)          | Fixed     |
| Improper Values in Event Emission                            | Low        | **R2** (ONRE-4)          | Fixed     |
| Missing Input Validation (empty string name, missing events) | Suggestion | **R3** (S1)              | Fixed     |
| Missing Documentation                                        | Suggestion | **R3** (S2)              | Fixed     |
| Code Improvements (comments, error codes, CHECK directive)   | Suggestion | **R2** (S6), **R5** (S4) | Mitigated |

### 9. GLOBAL APPROVER SYSTEM

| Detail                                        | Severity   | Reports        | Status          |
| --------------------------------------------- | ---------- | -------------- | --------------- |
| Approver Key Rotation causes approval lockout | **Medium** | **R4** (M2)    | Partially Fixed |
| Distinct Accounts for Approver Roles          | Low        | **R5** (ONR-7) | Fixed           |

### 10. CODE QUALITY / CLEANUP

| Detail                                                          | Severity   | Reports     | Status    |
| --------------------------------------------------------------- | ---------- | ----------- | --------- |
| Unnecessary code logic (bump seeds, writable flags, MAX_OFFERS) | Info       | **R4** (I1) | Fixed     |
| Use UncheckedAccount instead of AccountInfo                     | Suggestion | **R5** (S1) | Mitigated |
| Default Value for State.redemption_admin                        | Suggestion | **R5** (S2) | Fixed     |
| Validate Ed25519 Program Data                                   | Suggestion | **R5** (S3) | Fixed     |
| Missing Validation (various)                                    | Suggestion | **R5** (S5) | Mitigated |

---

## Open / Unresolved Risk Summary

The following findings remain **unfixed** (Acknowledged, Partially Fixed, or Mitigated without full resolution):

| #   | Finding                                                            | Status              | Reports | Risk                                                                  |
| --- | ------------------------------------------------------------------ | ------------------- | ------- | --------------------------------------------------------------------- |
| 1   | **No slippage protection** on take_offer                           | Acknowledged        | R2, R5  | 🟡 Users can receive less than expected at interval boundaries        |
| 2   | **No Token-2022 extension validation** on-chain                    | Acknowledged        | R4      | 🟡 Permanent delegate, transfer fees, freeze authority unchecked      |
| 3   | **Approver rotation still breaks approvals** (partial fix)         | Partially Fixed     | R4      | 🟡 Removing both approvers + re-adding invalidates existing approvals |
| 4   | **Fee changes — no timelock / TOCTOU**                             | Acknowledged        | R4, R5  | 🟡 Boss can change fees at any time; user may pay unexpected fees     |
| 5   | **Mint authority inaccessible after boss transfer**                | Acknowledged        | R5      | 🟡 Boss transfer without updating mint authority = permanent DoS      |
| 6   | **Backdated vector prices** (retroactive APR)                      | Acknowledged        | R4      | 🟠 Design feature but can cause unexpected price jumps                |
| 7   | **APY model inconsistency** (compound display vs linear execution) | Acknowledged        | R4      | 🟢 Informational — misleading users                                   |
| 8   | **Init frontrun on immutable deployments**                         | Acknowledged        | R5      | 🟠 Niche scenario (immutable deploy), low probability                 |
| 9   | **Offer ID uniqueness not enforced**                               | Acknowledged        | R1      | 🟠 Off-chain enforcement; replay/reuse confusion possible             |
| 10  | **Precision loss (9→6 decimals)**                                  | Acknowledged        | R1      | 🟢 Known limitation, very small amounts                               |
| 11  | **Code duplication (permissionless)**                              | Acknowledged        | R3      | 🟢 Deferred to new version                                            |
| 12  | **Missing min offer duration**                                     | Acknowledged        | R2      | 🟢 Relies on boss responsibility                                      |
| 13  | **Kill switch not enforced in minting**                            | Acknowledged        | R5      | 🟢 Intentional — boss can mint during pause                           |
| 14  | **delete_offer_vector validation off-by-one** (should be `>=`)     | Unresolved in R5 S5 | R5      | 🟢 Minor                                                              |
| 15  | **set_redemption_admin missing Pubkey::default() check**           | Unresolved in R5 S5 | R5      | 🟢 Minor                                                              |
| 16  | **redemption_withdraw boss_token_account not mutable**             | Unresolved in R5 S5 | R5      | 🟢 Minor                                                              |
| 17  | **W9/W10 side-effect: fee increase from 0→non-zero DoS**           | Acknowledged        | R4      | 🟡 Existing offers using that token become un-takeable                |

---

## Key Guidance for Bounty Audit

### Do NOT Re-report (Already Fixed)

- High-severity pricing bug (R2/ONRE-1) — fixed
- High-severity redemption association check (R5/ONR-1) — fixed
- All Medium-severity issues except M2 (partial) and M4 (acknowledged) — fixed
- Unboxed accounts stack overflow (R3) — fixed
- All Token-2022 transfer fee issues (R4 W9/W10) — fixed

### CAN Re-evaluate (Previously Fixed — verify fix is complete)

- Initialization frontrunning: was mitigated → fixed → acknowledged across 3 reports. Current state uses upgrade authority check per R4 fix. Verify immutable deployment edge case still handled.
- Supply cap (M3): verify setting max_supply=0 truly removes cap (intentional?).
- Two-step ownership transfer (L1): verify propose+accept is complete.
- Floor division → ceiling division (ONR-13): verify in current codebase.

### FOCUS ON (Highest value for bounty)

1. **Slippage protection** — most flagged, never fixed. If still missing, it's a valid finding.
2. **Token-2022 extension validation** — M4 acknowledged but never code-fixed. If no on-chain checks exist, this is valid.
3. **Fee TOCTOU / timelock** — flagged twice across two different auditors (Ackee W8, Quantstamp R5 ONR-6).
4. **Centralization risks** — W5 partially fixed. No on-chain multisig enforcement.
5. **Edge cases in current implementation** not covered by any prior report (new code paths).
