# ChainVote — Security Policy & Cryptographic Model

## 1. Cryptographic Model & Guarantees

### What Is Protected
1. **Single-Vote Invariant (Double-Voting Prevention):**
   - Each voter is issued a pseudonymous cryptographic nullifier commitment:
     $$\text{Nullifier} = \text{SHA256}(\text{VoterIdentifierHash} \mathbin{\Vert} \text{ElectionId})$$
   - When a vote is cast, `VotingSystem.sol` records `hasVotedNullifier[electionId][nullifier] = true`.
   - Any second attempt to cast a vote with the same nullifier is rejected at the smart contract level, even if the backend database is compromised.
2. **State Machine Integrity:**
   - Elections cannot be modified after launch. Candidate lists cannot be tampered with once the election state reaches `OPEN`.
3. **Password Security:**
   - Administrative credentials are encrypted using `bcrypt` (work factor 12) with unique salts, providing resistance against dictionary and pre-computed rainbow table attacks.

### What Is Public
* Election IDs, titles, and candidate names.
* On-chain vote tallies per candidate.
* Nullifier hashes and transaction hashes in public block events.
* Block confirmation numbers and timestamps.

### What Is Private
* Voter National ID / email identifiers (stored solely as salted SHA-256 hashes off-chain).
* Association between the voter's real-world identity and their specific candidate ballot.

---

## 2. Accurate Technical Limitations (Honesty Disclosure)

To maintain software engineering credibility, ChainVote openly documents current architectural trade-offs:
1. **Relayer Trust Model:**
   - In the current relayed voting architecture, the backend relayer sponsors gas fees. While the relayer cannot cast double votes (enforced by smart contract nullifiers), a malicious relayer could theoretically refuse to submit a transaction (censorship).
   - **Planned Improvement:** Allow direct client-side Web3 wallet voting (`castVote`) where voters sign and pay their own gas, bypassing the relayer entirely.
2. **National ID Verification (Demo Mode):**
   - The current voter verification endpoint uses a mock OTP system (`123456`) simulating a government National ID provider. In production, this would integrate with e-ID APIs (e.g. Aadhaar XML offline verification or OAuth OIDC).
3. **Receipt-Free Anonymity vs. Zero-Knowledge:**
   - While nullifiers unlink the voter's identity from the blockchain transaction, ChainVote does **not** yet utilize zero-knowledge SNARK circuits. ZK-SNARK protocols (e.g., Semaphore / MACI) are planned for the next major milestone.
