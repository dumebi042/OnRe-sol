# **OnRe**

|  
OnRe issues ONyc, a yield-bearing token on Solana whose value tracks a portfolio of short-duration reinsurance contracts. Capital backing ONyc is held by On Re SAC Ltd, a Special Purpose Insurer regulated by the Bermuda Monetary Authority, and deployed into reinsurance positions where returns come from real-world premium income rather than token emissions or subsidies. The Solana program governs minting, redemption, on-chain NAV calculation, supply caps, vault accounting, and the role-based authority that operates the protocol.  
Solana  
Defi  
Insurance  
Rust  
Maximum Bounty  
$100,000  
Live Since  
11 May 2026  
Last Updated  
14 May 2026

* Runnable PoC Required  
* KYC required

[Submit a Bug](https://bugs.immunefi.com/dashboard/new-submission?utm_source=immunefi)  
[Information](https://immunefi.com/bug-bounty/onre/information/#top)  
[Scope](https://immunefi.com/bug-bounty/onre/scope/#top)  
[Resources](https://immunefi.com/bug-bounty/onre/resources/#top)

### **Rewards**

OnRe provides rewards in USDC on Solana, denominated in USD.

### **Rewards by Threat Level**

Smart Contract  
Critical  
Max: $100,000Min: $10,000  
Primacy of Rules  
High  
Flat: $5,000  
Primacy of Rules  
Medium  
Flat: $2,000  
Primacy of Rules  
Low  
Flat: $1,000  
Primacy of Rules  
Critical Reward Calculation

### **Mainnet assets:**

Reward amount is 10% of the funds directly affected up to a maximum of:  
$100,000  
Minimum reward to discourage security researchers from withholding a bug report:  
$10,000

### **Rewards Body**

Rewards are distributed according to the impact the vulnerability could otherwise cause based on the Impacts in Scope table further below.

#### **Reward Calculation for Critical Level Reports**

For critical Smart Contract bugs, the reward amount is 10% of the funds directly affected up to a maximum of USD 100,000. The calculation of the amount of funds at risk is based on the time and date the bug report is submitted, and is bounded by on-chain assets exposed by the vulnerability, including but not limited to the offer and redemption vault balances and the value of any ONyc that could be minted without corresponding deposit. Capital held off-chain by On Re SAC Ltd in the regulated Bermuda SAC is not reachable from the Solana program and is therefore excluded from the funds-at-risk calculation. A minimum reward of USD 10,000 applies in order to incentivize security researchers against withholding a bug report.

#### **Deployed Contract Requirement**

To be eligible for a reward, the reported vulnerability must be present in the most recently deployed smart contract and must produce an eligible impact against an asset in scope.  
Vulnerabilities that exist only in the GitHub source code, but not in the deployed contract, are not eligible for a reward. This may happen where a vulnerability has already been fixed in the deployed artifact or on-chain program before the public source code or related communication has been updated.  
For the purpose of reward eligibility, the deployed contract takes precedence over the GitHub source code.

#### **Repeatable Attack Limitations**

In cases of repeatable attacks for smart contract bugs, only the first attack will be counted, regardless of whether the smart contract is upgradable, pausable, or killable.  
Previous Audits  
OnRe has provided these completed audit reports for reference. Any unfixed vulnerability mentioned in these reports is not eligible for a reward.

### **Proof of Concept (PoC) Requirements**

A PoC is required for the following severity levels:

* Smart Contract, Critical Severity Level  
* Smart Contract, High Severity Level  
* Smart Contract, Medium Severity Level  
* Smart Contract, Low Severity Level

All PoCs submitted must comply with the Immunefi-wide [PoC Guidelines and Rules.](https://immunefisupport.zendesk.com/hc/en-us/articles/9946217628561-Proof-of-Concept-PoC-Guidelines-and-Rules?utm_source=immunefi) PoCs for the OnRe Solana program should be runnable in a deterministic local environment such as \`solana-program-test\`, \`anchor-bankrun\`, or LiteSVM, against the source at the commit specified in Assets in Scope. Bug report submissions without a PoC when a PoC is required will not be provided with a reward.

### **Reward Payment Terms**

Payouts are handled by the OnRe team directly and are denominated in USD. However, payments are done in USDC.  
 [View impacts in scope](https://immunefi.com/bug-bounty/onre/scope/#impacts)

### **Program Overview**

OnRe issues ONyc, a yield-bearing Solana token backed by a portfolio of short-duration reinsurance contracts. Capital is held by On Re SAC Ltd (a Special Purpose Insurer regulated by the Bermuda Monetary Authority) and earns yield from real-world insurance premiums. The Solana program at `onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe` controls minting, redemption, and NAV computation. The collateral itself is held off-chain in the regulated Bermuda SAC and is therefore not reachable from the on-chain program; this bug bounty focuses on the on-chain Solana program and the supporting components listed under Assets in Scope.  
For more information about OnRe, please visit [https://onre.finance/](https://onre.finance/?utm_source=immunefi). Technical and security documentation is available at [https://docs.onre.finance/](https://docs.onre.finance/?utm_source=immunefi).  
OnRe provides rewards in USDC. For more details about the payment process, please view the Rewards by Threat Level section further below.

### **KYC Requirement**

The provision of KYC is required to receive a reward for this bug bounty program where the following information will be required to be provided:

* Identity Document  
* Proof of Address

KYC information is only required on confirmation of the validity of a bug report and will be handled by [Onfido](https://onfido.com/?utm_source=immunefi).  
Researchers resident in [jurisdictions excluded under OnRe's policy](https://docs.onre.finance/legal/onyc-excluded-jurisdictions?utm_source=immunefi) and researchers in OFAC-sanctioned jurisdictions are not eligible to receive rewards.

### **Primacy of Impact vs Primacy of Rules**

OnRe adheres to the Primacy of Rules, which means that the whole bug bounty program is run strictly under the terms stated in this page.

### **Audits**

| Auditor | Link |  |
| :---- | :---- | :---- |
| Quantstamp | [https://certificate.quantstamp.com/full/nayms-on-re-offer-redemption-program-spec/caed5b0c-4b32-4d01-9a3a-aa2174f5485f/index.html](https://certificate.quantstamp.com/full/nayms-on-re-offer-redemption-program-spec/caed5b0c-4b32-4d01-9a3a-aa2174f5485f/index.html?utm_source=immunefi) | 28 March 2025 |
| Quantstamp | [https://certificate.quantstamp.com/full/on-re-solana/c31251fd-f107-478d-ac17-6d9ad6bd3faa/index.html](https://certificate.quantstamp.com/full/on-re-solana/c31251fd-f107-478d-ac17-6d9ad6bd3faa/index.html?utm_source=immunefi) | 19 May 2025 |
| Quantstamp | [https://certificate.quantstamp.com/full/on-re-solana-diff/b36b9c22-ed00-48e4-bbd1-66f98285a37b/index.html](https://certificate.quantstamp.com/full/on-re-solana-diff/b36b9c22-ed00-48e4-bbd1-66f98285a37b/index.html?utm_source=immunefi) | 26 August 2025 |
| Ackee | [https://app.onre.finance/files/ackee-blockchain-onre-onre-report.pdf](https://app.onre.finance/files/ackee-blockchain-onre-onre-report.pdf?utm_source=immunefi) | 25 November 2025 |
| Quantstamp | [https://certificate.quantstamp.com/full/onre-re-audit-2/41c2f85f-90ce-42ee-aac8-a810e0f0ec99/index.html](https://certificate.quantstamp.com/full/onre-re-audit-2/41c2f85f-90ce-42ee-aac8-a810e0f0ec99/index.html?utm_source=immunefi) | 20 December 2025 |

### **Known Issues**

| Category | Description / Link | Date |
| :---- | :---- | :---- |
| Smart Contract | The update\_offer\_fee instruction validated the new fee against \`MAX\_BASIS\_POINTS\` (10000 bps, 100%) instead of \`MAX\_ALLOWED\_FEE\_BPS\` (1000 bps, 10%), the constant \`make\_offer\` uses. This let an existing offer be updated to a fee above the protocol's 10% ceiling. The instruction is gated to the protocol boss, which on mainnet is the Squads V4 multisig at \`45YnzauhsBM8CpUz96Djf8UG5vqq2Dua62wuW9H3jaJ5\`. No unprivileged path reaches this code. Fee mutability and timing are also covered by acknowledged finding W8 in the public Ackee Blockchain Security audit, and by the documented trust model (Report Revision 1.0, page 19). The constant has been corrected and the cap now matches \`make\_offer\`. Any submission describing the same constant mismatch or the resulting "fee escalates above 10% via \`update\_offer\_fee\`" behavior is a duplicate of this known issue. [https://github.com/o...b06f2b69bd10f8aa4d9f](https://github.com/onre-finance/onre-sol/commit/b1d24ca734b64d60ac72b06f2b69bd10f8aa4d9f?utm_source=immunefi) | 13 May 2026 |

### **KYC required**

The submission of KYC information is a requirement for payout processing.  
Participants must adhere to the Eligibility Criteria.

### **Proof of Concept**

Proof of concept is always required for all severities.

### **Responsible Publication**

Category 3: Approval Required

### **Prohibited Activities**

Default prohibited activities

* Any testing on mainnet or public testnet deployed code; all testing should be done on local-forks of either public testnet or mainnet  
* Any testing with pricing oracles or third-party smart contracts  
* Attempting phishing or other social engineering attacks against our employees and/or customers  
* Any testing with third-party systems and applications (e.g. browser extensions) as well as websites (e.g. SSO providers, advertising networks)  
* Any denial of service attacks that are executed against project assets  
* Automated testing of services that generates significant amounts of traffic  
* Public disclosure of an unpatched vulnerability in an embargoed bounty  
* [Any other actions prohibited by the Immunefi Rules](https://immunefi.com/rules/)

### **Feasibility Limitations**

The project may be receiving reports that are valid (the bug and attack vector are real) and cite assets and impacts that are in scope, but there may be obstacles or barriers to executing the attack in the real world. In other words, there is a question about how feasible the attack really is. Conversely, there may also be mitigation measures that projects can take to prevent the impact of the bug, which are not feasible or would require unconventional action and hence, should not be used as reasons for downgrading a bug's severity.  
Therefore, Immunefi has developed a set of feasibility limitation standards which by default states what security researchers, as well as projects, can or cannot cite when reviewing a bug report.

* [Chain Rollbacks](https://immunefisupport.zendesk.com/hc/en-us/articles/16913153448721-Chain-Rollbacks?utm_source=immunefi)  
* [Pre-Impact Bug Monitoring](https://immunefisupport.zendesk.com/hc/en-us/articles/19430444320401-Pre-Impact-Bug-Monitoring?utm_source=immunefi)  
* [Attack Investment Amount](https://immunefisupport.zendesk.com/hc/en-us/articles/17243068885265-Attack-Investment-Amount?utm_source=immunefi)  
* [Attacks With A Financial Risk To The Attacker](https://immunefisupport.zendesk.com/hc/en-us/articles/17454897136401-Attacks-With-A-Financial-Risk-To-The-Attacker?utm_source=immunefi)  
* [When Is An Impactful Attack Downgraded To Griefing?](https://immunefisupport.zendesk.com/hc/en-us/articles/17455102268305-When-Is-An-Impactful-Attack-Downgraded-To-Griefing?utm_source=immunefi)

