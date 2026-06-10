## All Investigations Complete — Comprehensive Summary



### Final Verdicts



| Target | Finding | Verdict | Severity | Key Reason |

|--------|---------|---------|----------|------------|

| **P2** | Token-2022 transfer fee blocks redemption lifecycle | **VALID** | **Medium** | Offer path blocks via `has_transfer_fee()`, redemption path has NO check. Vault receives less than recorded amount → cancel/fulfill both fail. **Not submission-ready** — needs deployed-contract verification, local PoC blocked by BPF stack overflow. |

| **P5** | Price calculation rounding/truncation | **KILL** | — | Max error ~$0.000009 per 10,000 USDC trade. Well below gas costs. Not economically meaningful. |

| **P8** | Approval message scope/replay | **WEAK** | — | Intentional design as KYC/allowlist gate, not per-trade authorization. No incremental economic impact. |

| **P4** | V1 take_offer bypasses V5 buffer | **KILL** | — | V5 buffer/accrual system does NOT exist on current `main` branch. Already documented in `programV5-findings.md`. |

| **P3** | Redemption vault withdraw bypasses accounting | **KILL** | — | Requires `boss` (Squads multisig). Out of scope per bounty rules (privileged address). Already documented in `bounty-findings-new.md`. |



### Deliverables Created



| File | Description |

|------|-------------|

| [`audits/P2-token2022-transfer-fee-redemption.md`](audits/P2-token2022-transfer-fee-redemption.md) | Submission-grade Medium report — Token-2022 transfer fee in redemption path |

| [`tests/redemption/token2022_transfer_fee_vulnerability.spec.ts`](tests/redemption/token2022_transfer_fee_vulnerability.spec.ts) | Code-level proof with 6 exploit steps, source line references, and mathematical proof |

| [`tests/price_rounding_analysis.script.ts`](tests/price_rounding_analysis.script.ts) | 143 scenarios tested — max error < $0.000009 |



### Remaining Items (User's Discretion)



| Target | Status |

|--------|--------|

| **P1**: `update_offer_fee` 100% cap | Not started — requires deployed-contract verification on-chain |

| **P6**: `delete_offer_vector` off-by-one | Not started — Info, known unresolved (R5/S5) |

| **P7**: `close_state` raw byte manipulation | Not started — Low, requires boss |



### P2 — What's Needed Before Submission



1. **Verify deployed contract** at `onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe` — confirm `has_transfer_fee()` check is absent from redemption path in the deployed binary

2. **Confirm BPF stack overflow** doesn't affect the deployed binary (may have been compiled with different settings)

3. **Dynamic PoC** — use `solana-test-validator` against the deployed program ID, or compile with stack overflow fix (wrap `MakeOffer` accounts in `Box<>`)

## P4 Investigation Complete — Verdict: **KILL**



### V5 buffer/accrual system does NOT exist on current `main` branch



### Key Findings



1. **Only one `take_offer` entry point exists** in [`lib.rs:223`](programs/onreapp/src/lib.rs:223) — there is no V2 `take_offer_v2` registered

2. **No buffer-related code exists** in the entire `programs/onreapp/src/` directory — no `BufferState`, `BufferAccrualAccounts`, `accrue_buffer`, `accrual_utils`, `previous_supply`, `offer_proceeds_vault`, `offer_fee_vault`, or `redemption_vault_authority`

3. **The `origin/programV5` branch is not merged** — the V5 code is in a separate branch that has not been incorporated into `main`

4. **This exact finding is already documented** in [`audits/programV5-findings.md:9-117`](audits/programV5-findings.md) as Finding 1 (High severity)



### Verdict Summary



| Component | Assessment |

|-----------|-----------|

| **Vulnerability exists in current `main` code?** | **NO** — V5 buffer system not present |

| **Vulnerability would exist if V5 merged?** | **YES** — as documented in `programV5-findings.md` |

| **Finding novelty vs prior audits?** | **New** (V5 code postdates all 5 audits) |

| **Finding novelty vs internal work?** | **Duplicate** — already documented internally |

| **Submission readiness** | **Not ready** — not applicable to current `main` branch |



### Recommended Action



**Do NOT submit.** This is a valid concern for the `origin/programV5` branch but not a current vulnerability in the audited deployment at `onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe`. When V5 is merged, the finding from `programV5-findings.md` should be re-verified against the merged code.

## P1 Investigation Complete — Verdict: **KILL**

### Do Not Submit — Explicitly Listed as Known Issue

**Result**: The source code at [`update_offer_fee.rs:99`](programs/onreapp/src/instructions/offer/update_offer_fee.rs:99) still uses `MAX_BASIS_POINTS` (10000 = 100%). The fix commit exists on GitHub but is **not present in this local repo** (only 1 commit `d32b576`). We cannot independently verify the deployed binary without BPF decompilation.

**Why KILL**:

| Reason | Evidence |
|--------|----------|
| ✅ Explicitly listed as known issue | [`OnRe-bounty-instructions.md:122`](OnRe-bounty-instructions.md:122): *"`update_offer_fee`... Any submission describing the same bug is a duplicate"* |
| ✅ Covered by two prior audits | Ackee R4 W8 (Acknowledged) + Quantstamp R5 ONR-6 (Acknowledged) |
| ✅ Boss-gated | Requires `state.boss` (Squads V4 multisig) — no unvetted exploit path |
| ❌ Zero novelty | Documented across multiple reports and the bounty page |
| Cannot independently verify deployed binary | 1.8MB BPF payload at `onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe` — would need decompilation tools |

---

## Complete Audit Summary — All Targets Investigated

| Target | Verdict | Severity | Why |
|--------|---------|----------|-----|
| **P2** Token-2022 transfer fee → redemption stuck | **VALID** | **Medium** | Only submission-grade finding. Offer path blocks, redemption path doesn't. Not submission-ready (needs deployed verification + BPF stack overflow resolved). |
| **P1** `update_offer_fee` 100% cap | **KILL** | — | Known issue, listed in bounty rules, boss-gated |
| **P3** Redemption vault withdraw no accounting | **KILL** | — | Out of scope (requires boss), already documented |
| **P4** V1 bypasses V5 buffer | **KILL** | — | V5 not in `main` branch, already documented |
| **P5** Price rounding | **KILL** | — | Dust error < $0.000009 per trade |
| **P6** `delete_offer_vector` off-by-one | Skipped | Info | Known unresolved (R5/S5), zero bounty value |
| **P7** `close_state` byte manipulation | Skipped | Low | Boss-gated, design choice |
| **P8** Approval message scope | **WEAK** | — | Intentional KYC/allowlist design |

### Only remaining actionable item: **P2 submission hardening**
- Verify deployed contract has the `has_transfer_fee()` gap
- Resolve BPF stack overflow for dynamic PoC
- Then submit Medium finding to Immunefi
## P7 Investigation Complete — Verdict: **KILL**

### Key Corrective Finding

The hypothesis about `close_state` was based on an older code version. The current implementation is **much simpler**:
- Only closes the **state account itself** — does NOT touch offers, token accounts, vaults, or redemption authorities
- Boss found at correct byte offset `data[8..40]` (offset 8 after discriminator, 32 bytes for Pubkey) ✅
- State struct is **946 bytes** (not the hypothesized larger struct with 1239-byte reserved field)
- PDA validation + ownership check + boss signer check provide strong security
- Boss-only function → out of scope per bounty rules

The only minor finding: [`data.len()` check at line 98](programs/onreapp/src/instructions/state_operations/close_state.rs:98) uses `>= 40` instead of the actual expected size (946 bytes). But the PDA validation prevents passing wrong accounts.

---

## Final Bounty Audit Summary — All Targets Complete

| Target | Finding | Verdict | Why |
|--------|---------|---------|-----|
| **P2** 🔴 | Token-2022 transfer fee blocks redemption lifecycle | **VALID** — **Medium** | Only submission-grade finding. Offer path blocks via `has_transfer_fee()`, redemption path has NO check. Vault receives less than recorded → cancel/fulfill both fail. Report at [`audits/P2-token2022-transfer-fee-redemption.md`](audits/P2-token2022-transfer-fee-redemption.md). |
| **P1** | `update_offer_fee` 100% cap | **KILL** | Known issue listed in bounty rules (Ackee W8). Zero novelty. |
| **P3** | Redemption vault withdraw no accounting | **KILL** | Out of scope (requires `state.boss` — Squads multisig). Already documented in `bounty-findings-new.md`. |
| **P4** | V1 `take_offer` bypasses V5 buffer | **KILL** | V5 buffer system does NOT exist on current `main` branch. Already documented in `programV5-findings.md`. |
| **P5** | Price calculation rounding | **KILL** | Max error ~$0.000009 per 10k trade — well below gas costs. 143 scenarios tested. |
| **P6** | `delete_offer_vector` off-by-one | Skipped | Info severity, known unresolved from R5/S5. |
| **P7** | `close_state` raw byte manipulation | **KILL** | Hypothesis inaccurate — current code is simple (only closes state account, not offers/vaults). Boss-only, out of scope. |
| **P8** | Approval message scope/replay | **WEAK** | Intentional KYC/allowlist design. No incremental economic impact. |

### Assets Created

| File | Description |
|------|-------------|
| [`audits/P2-token2022-transfer-fee-redemption.md`](audits/P2-token2022-transfer-fee-redemption.md) | Submission-grade Medium report, conservative wording, self-review gate |
| [`tests/redemption/token2022_transfer_fee_vulnerability.spec.ts`](tests/redemption/token2022_transfer_fee_vulnerability.spec.ts) | 287-line code-level proof with 6 exploit steps |
| [`tests/price_rounding_analysis.script.ts`](tests/price_rounding_analysis.script.ts) | 143 rounding scenarios — max error quantified |

### What Would Be Needed for P2 Submission

1. **Verify deployed contract** at `onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe` has the `has_transfer_fee()` gap
2. **Resolve BPF stack overflow** (Box-wrapping `MakeOffer` account struct) for dynamic PoC
3. **Harden report wording** — already done in `audits/P2-token2022-transfer-fee-redemption.md`
