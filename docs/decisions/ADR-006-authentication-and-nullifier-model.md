# ADR-006: Cryptographic Nullifier & Authorization Model

## Context
Traditional electronic voting systems either link voter identity directly to the ballot choice (destroying privacy) or rely entirely on a centralized database flag (destroying decentralization and trust).

## Decision
We implemented a cryptographic nullifier commitment pattern:
$$\text{Nullifier} = \text{SHA256}(\text{VoterIdentifierHash} \mathbin{\Vert} \text{ElectionId})$$
The nullifier is recorded in `VotingSystem.sol` inside a boolean mapping `hasVotedNullifier[electionId][nullifier]`.

## Rationale
1. **Unlinkability:** The blockchain stores the nullifier hash, but cannot reverse it to determine which citizen cast the vote.
2. **Double-Voting Defense:** Once a nullifier is spent in an election, no subsequent transaction containing that nullifier can succeed on-chain.
3. **Multi-Election Isolation:** The election ID is mixed into the nullifier preimage, ensuring a voter can participate in Election A and Election B independently without linkability across sessions.

## Consequences
- Requires the authorization service to pre-generate and commit nullifiers during voter onboarding.
