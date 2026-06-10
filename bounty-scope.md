### **Assets in Scope**

| Target | Name |  |
| :---- | :---- | :---- |
| [https://solscan.io/a...tvvGvoepBPkqyaubFcwe](https://solscan.io/account/onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe?utm_source=immunefi) | OnRe Program | 30 April 2026 |

### **Impacts in Scope**

| Critical | Direct theft of any user funds, whether at-rest or in-motion, other than unclaimed yield from an unvetted address |
| :---- | :---- |
| Critical | Permanent freezing of funds from an unvetted address |
| Critical | Protocol insolvency from an unvetted address |
| Critical | Manipulation of user roles inside the system via unvetted wallet or smart contract that may result in any critical severity issue |
| Critical | Manipulation of governance voting result deviating from voted outcome and resulting in a direct change from intended effect of original results |
| Critical | Direct theft of any user funds, whether at-rest or in-motion, other than unclaimed yield |
| Critical | Permanent freezing of funds |
| High | Manipulation of user roles inside the system via unvetted wallet or smart contract that may result in any high severity issue |
| High | Theft of unclaimed yield |
| High | Theft of unclaimed royalties |
| High | Permanent freezing of unclaimed yield |
| High | Permanent freezing of unclaimed royalties |
| High | Temporary freezing of funds |
| Medium | Griefing (e.g. no profit motive for an attacker, but damage to the users or the protocol) |
| Medium | Theft of gas |
| Medium | Unbounded gas consumption |
| Low | Contract fails to deliver promised returns, but doesn't lose value |

Collapse  
 [View rewards](https://immunefi.com/bug-bounty/onre/information/#rewards)

### **Out of scope**

Default Out of Scope and rules  
Smart Contract specific

* Incorrect data supplied by third party oracles  
  * Not to exclude oracle manipulation/flash loan attacks  
* Impacts requiring basic economic and governance attacks (e.g. 51% attack)  
* Lack of liquidity impacts  
* Impacts from Sybil attacks  
* Impacts involving centralization risks

All categories

* Impacts requiring attacks that the reporter has already exploited themselves, leading to damage  
* Impacts caused by attacks requiring access to leaked keys/credentials  
* Impacts caused by attacks requiring access to privileged addresses (including, but not limited to: governance and strategist contracts) without additional modifications to the privileges attributed  
* Impacts relying on attacks involving the depegging of an external stablecoin where the attacker does not directly cause the depegging due to a bug in code  
* Mentions of secrets, access tokens, API keys, private keys, etc. in Github will be considered out of scope without proof that they are in-use in production  
* Best practice recommendations  
* Feature requests  
* Impacts on test files and configuration files unless stated otherwise in the bug bounty program  
* Impacts requiring phishing or other social engineering attacks against project's employees and/or customers

