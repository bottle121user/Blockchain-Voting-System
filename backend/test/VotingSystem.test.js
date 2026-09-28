const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("VotingSystem Multi-Election Contract", function () {
    let VotingSystem;
    let votingSystem;
    let admin;
    let relayer;
    let voter1;
    let voter2;
    let unauthorized;

    const ELECTION_ORGANIZER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ELECTION_ORGANIZER_ROLE"));
    const RELAYER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RELAYER_ROLE"));

    beforeEach(async function () {
        [admin, relayer, voter1, voter2, unauthorized] = await ethers.getSigners();
        VotingSystem = await ethers.getContractFactory("VotingSystem");
        votingSystem = await VotingSystem.deploy(admin.address, relayer.address);
        await votingSystem.waitForDeployment();
    });

    describe("Deployment & Access Control", function () {
        it("should grant DEFAULT_ADMIN_ROLE and ELECTION_ORGANIZER_ROLE to admin", async function () {
            const DEFAULT_ADMIN_ROLE = await votingSystem.DEFAULT_ADMIN_ROLE();
            expect(await votingSystem.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
            expect(await votingSystem.hasRole(ELECTION_ORGANIZER_ROLE, admin.address)).to.be.true;
        });

        it("should grant RELAYER_ROLE to the specified relayer address", async function () {
            expect(await votingSystem.hasRole(RELAYER_ROLE, relayer.address)).to.be.true;
            expect(await votingSystem.hasRole(RELAYER_ROLE, unauthorized.address)).to.be.false;
        });

        it("should revert if initialized with zero address admin", async function () {
            await expect(
                VotingSystem.deploy(ethers.ZeroAddress, relayer.address)
            ).to.be.revertedWith("VotingSystem: Root admin cannot be zero address");
        });
    });

    describe("Election Lifecycle & State Machine", function () {
        it("should create a new election in CREATED state", async function () {
            const tx = await votingSystem.createElection("Student Council 2026", "Annual university election");
            await expect(tx)
                .to.emit(votingSystem, "ElectionCreated")
                .withArgs(1, "Student Council 2026", admin.address, anyValue);

            const election = await votingSystem.getElection(1);
            expect(election.id).to.equal(1);
            expect(election.name).to.equal("Student Council 2026");
            expect(election.state).to.equal(0); // CREATED
            expect(election.candidatesCount).to.equal(0);
        });

        it("should reject election creation with empty name", async function () {
            await expect(
                votingSystem.createElection("", "Description")
            ).to.be.revertedWith("VotingSystem: Election name cannot be empty");
        });

        it("should allow adding candidates in CREATED and REGISTRATION states", async function () {
            await votingSystem.createElection("General Election", "Gov election");
            
            // In CREATED state
            await expect(votingSystem.addCandidate(1, "Alice"))
                .to.emit(votingSystem, "CandidateAdded")
                .withArgs(1, 0, "Alice");

            // Transition to REGISTRATION
            await votingSystem.openRegistration(1);

            // In REGISTRATION state
            await expect(votingSystem.addCandidate(1, "Bob"))
                .to.emit(votingSystem, "CandidateAdded")
                .withArgs(1, 1, "Bob");

            const candidates = await votingSystem.getCandidates(1);
            expect(candidates.length).to.equal(2);
            expect(candidates[0].name).to.equal("Alice");
            expect(candidates[1].name).to.equal("Bob");
        });

        it("should prevent opening election with fewer than 2 candidates", async function () {
            await votingSystem.createElection("Single Candidate Election", "Test");
            await votingSystem.addCandidate(1, "Solo Candidate");
            await expect(votingSystem.openElection(1))
                .to.be.revertedWith("VotingSystem: At least 2 candidates required to open election");
        });

        it("should properly transition CREATED -> OPEN when >=2 candidates exist", async function () {
            await votingSystem.createElection("Presidency", "2026");
            await votingSystem.addCandidate(1, "Alice");
            await votingSystem.addCandidate(1, "Bob");

            await expect(votingSystem.openElection(1))
                .to.emit(votingSystem, "ElectionStateChanged");

            const election = await votingSystem.getElection(1);
            expect(election.state).to.equal(2); // OPEN
        });

        it("should not allow adding candidates once the election is OPEN", async function () {
            await votingSystem.createElection("Presidency", "2026");
            await votingSystem.addCandidate(1, "Alice");
            await votingSystem.addCandidate(1, "Bob");
            await votingSystem.openElection(1);

            await expect(
                votingSystem.addCandidate(1, "Charlie")
            ).to.be.revertedWith("VotingSystem: Candidates can only be added before election opens");
        });

        it("should allow closing an OPEN election", async function () {
            await votingSystem.createElection("Presidency", "2026");
            await votingSystem.addCandidate(1, "Alice");
            await votingSystem.addCandidate(1, "Bob");
            await votingSystem.openElection(1);

            await expect(votingSystem.closeElection(1))
                .to.emit(votingSystem, "ElectionStateChanged");

            const election = await votingSystem.getElection(1);
            expect(election.state).to.equal(3); // CLOSED
        });

        it("should finalize a CLOSED election", async function () {
            await votingSystem.createElection("Presidency", "2026");
            await votingSystem.addCandidate(1, "Alice");
            await votingSystem.addCandidate(1, "Bob");
            await votingSystem.openElection(1);
            await votingSystem.closeElection(1);

            await expect(votingSystem.finalizeElection(1))
                .to.emit(votingSystem, "ElectionStateChanged");

            const election = await votingSystem.getElection(1);
            expect(election.state).to.equal(4); // FINALIZED
        });

        it("should revert if attempting to finalize an election that is still OPEN", async function () {
            await votingSystem.createElection("Presidency", "2026");
            await votingSystem.addCandidate(1, "Alice");
            await votingSystem.addCandidate(1, "Bob");
            await votingSystem.openElection(1);

            await expect(
                votingSystem.finalizeElection(1)
            ).to.be.revertedWith("VotingSystem: Invalid election state for operation");
        });
    });

    describe("Voting Integrity & Nullifier Protection", function () {
        let nullifier1;
        let nullifier2;

        beforeEach(async function () {
            await votingSystem.createElection("General Election", "National");
            await votingSystem.addCandidate(1, "Alice");
            await votingSystem.addCandidate(1, "Bob");
            await votingSystem.openElection(1);

            nullifier1 = ethers.keccak256(ethers.toUtf8Bytes("secret-voter-token-1-election-1"));
            nullifier2 = ethers.keccak256(ethers.toUtf8Bytes("secret-voter-token-2-election-1"));
        });

        it("should record a direct vote successfully", async function () {
            await expect(votingSystem.connect(voter1).castVote(1, 0, nullifier1))
                .to.emit(votingSystem, "VoteCast")
                .withArgs(1, 0, nullifier1, voter1.address, anyValue);

            const candidates = await votingSystem.getCandidates(1);
            expect(candidates[0].voteCount).to.equal(1);
            expect(candidates[1].voteCount).to.equal(0);

            const election = await votingSystem.getElection(1);
            expect(election.totalVotes).to.equal(1);

            expect(await votingSystem.hasVotedNullifier(1, nullifier1)).to.be.true;
        });

        it("should strictly reject double voting with the same nullifier", async function () {
            await votingSystem.connect(voter1).castVote(1, 0, nullifier1);

            // Attempt voting again with same nullifier (even for different candidate or caller)
            await expect(
                votingSystem.connect(voter2).castVote(1, 1, nullifier1)
            ).to.be.revertedWith("VotingSystem: Double voting rejected - nullifier already spent");
        });

        it("should reject voting for an invalid candidate ID", async function () {
            await expect(
                votingSystem.connect(voter1).castVote(1, 999, nullifier1)
            ).to.be.revertedWith("VotingSystem: Invalid candidate ID");
        });

        it("should reject voting if nullifier is zero bytes", async function () {
            await expect(
                votingSystem.connect(voter1).castVote(1, 0, ethers.ZeroHash)
            ).to.be.revertedWith("VotingSystem: Invalid nullifier");
        });

        it("should allow an authorized relayer to submit castVoteRelayed", async function () {
            await expect(votingSystem.connect(relayer).castVoteRelayed(1, 1, nullifier2))
                .to.emit(votingSystem, "VoteCast")
                .withArgs(1, 1, nullifier2, relayer.address, anyValue);

            const candidates = await votingSystem.getCandidates(1);
            expect(candidates[1].voteCount).to.equal(1);
        });

        it("should revert castVoteRelayed if called by unauthorized account", async function () {
            await expect(
                votingSystem.connect(unauthorized).castVoteRelayed(1, 0, nullifier2)
            ).to.be.revertedWithCustomError(votingSystem, "AccessControlUnauthorizedAccount");
        });

        it("should prevent voting after the election has been closed", async function () {
            await votingSystem.closeElection(1);

            await expect(
                votingSystem.connect(voter1).castVote(1, 0, nullifier1)
            ).to.be.revertedWith("VotingSystem: Invalid election state for operation");
        });
    });

    describe("Multi-Election Isolation", function () {
        it("should isolate candidate tallies and nullifiers between multiple elections", async function () {
            // Election 1
            await votingSystem.createElection("Election 1", "Campus");
            await votingSystem.addCandidate(1, "Candidate E1-A");
            await votingSystem.addCandidate(1, "Candidate E1-B");
            await votingSystem.openElection(1);

            // Election 2
            await votingSystem.createElection("Election 2", "Faculty");
            await votingSystem.addCandidate(2, "Candidate E2-A");
            await votingSystem.addCandidate(2, "Candidate E2-B");
            await votingSystem.openElection(2);

            const nullifierE1 = ethers.keccak256(ethers.toUtf8Bytes("userA-election1"));
            const nullifierE2 = ethers.keccak256(ethers.toUtf8Bytes("userA-election2"));

            // Vote in Election 1
            await votingSystem.connect(voter1).castVote(1, 0, nullifierE1);
            
            // Vote in Election 2
            await votingSystem.connect(voter1).castVote(2, 1, nullifierE2);

            const candidatesE1 = await votingSystem.getCandidates(1);
            const candidatesE2 = await votingSystem.getCandidates(2);

            expect(candidatesE1[0].voteCount).to.equal(1);
            expect(candidatesE1[1].voteCount).to.equal(0);
            expect(candidatesE2[0].voteCount).to.equal(0);
            expect(candidatesE2[1].voteCount).to.equal(1);

            expect(await votingSystem.hasVotedNullifier(1, nullifierE1)).to.be.true;
            expect(await votingSystem.hasVotedNullifier(2, nullifierE1)).to.be.false;
        });
    });

    describe("Emergency Annulment & Linked Re-Election Protocol", function () {
        beforeEach(async function () {
            await votingSystem.createElection("Election To Annul", "Test Session");
            await votingSystem.addCandidate(1, "Candidate Alpha");
            await votingSystem.addCandidate(1, "Candidate Beta");
            await votingSystem.openElection(1);
        });

        it("should allow admin to annul an election with documented justification", async function () {
            const reason = "Severe credential leak detected among cohort B voters";
            const tx = await votingSystem.annulElection(1, reason);

            await expect(tx)
                .to.emit(votingSystem, "ElectionAnnulled")
                .withArgs(1, reason, admin.address, anyValue);

            await expect(tx)
                .to.emit(votingSystem, "ElectionStateChanged")
                .withArgs(1, 2, 5, anyValue); // OPEN(2) -> ANNULLED(5)

            const election = await votingSystem.getElection(1);
            expect(election.state).to.equal(5); // ANNULLED
            expect(election.annulmentReason).to.equal(reason);
            expect(election.closedAt).to.be.gt(0);
        });

        it("should reject annulment from unauthorized non-admin address", async function () {
            await expect(
                votingSystem.connect(unauthorized).annulElection(1, "Malicious attempt")
            ).to.be.revertedWithCustomError(votingSystem, "AccessControlUnauthorizedAccount");
        });

        it("should reject annulment with empty reason", async function () {
            await expect(
                votingSystem.annulElection(1, "")
            ).to.be.revertedWith("VotingSystem: Annulment reason cannot be empty");
        });

        it("should prevent casting ballots in an annulled election", async function () {
            await votingSystem.annulElection(1, "Breach detected");
            const nullifier = ethers.keccak256(ethers.toUtf8Bytes("voter-token"));

            await expect(
                votingSystem.connect(voter1).castVote(1, 0, nullifier)
            ).to.be.revertedWith("VotingSystem: Invalid election state for operation");
        });

        it("should prevent annulling an election that is already finalized", async function () {
            await votingSystem.closeElection(1);
            await votingSystem.finalizeElection(1);

            await expect(
                votingSystem.annulElection(1, "Late dispute")
            ).to.be.revertedWith("VotingSystem: Cannot annul an already finalized election");
        });

        it("should deploy a linked re-election inheriting candidate roster with reset counts", async function () {
            // Cast a vote in election 1 before annulment
            const nullifier = ethers.keccak256(ethers.toUtf8Bytes("compromised-voter"));
            await votingSystem.connect(voter1).castVote(1, 0, nullifier);

            // Annul election 1
            await votingSystem.annulElection(1, "Compromised voter credentials");

            // Deploy re-election
            const tx = await votingSystem.createReElection(1, "Credential rotation completed");
            await expect(tx)
                .to.emit(votingSystem, "ElectionCreated")
                .withArgs(2, "Re-Election: Election To Annul", admin.address, anyValue);

            const reElection = await votingSystem.getElection(2);
            expect(reElection.id).to.equal(2);
            expect(reElection.name).to.equal("Re-Election: Election To Annul");
            expect(reElection.state).to.equal(0); // CREATED
            expect(reElection.parentElectionId).to.equal(1);
            expect(reElection.totalVotes).to.equal(0);

            // Verify candidates cloned with reset vote counts
            const candidates = await votingSystem.getCandidates(2);
            expect(candidates.length).to.equal(2);
            expect(candidates[0].name).to.equal("Candidate Alpha");
            expect(candidates[0].voteCount).to.equal(0);
            expect(candidates[1].name).to.equal("Candidate Beta");
            expect(candidates[1].voteCount).to.equal(0);

            // Open re-election and verify voting works cleanly
            await votingSystem.openElection(2);
            const freshNullifier = ethers.keccak256(ethers.toUtf8Bytes("new-secure-token"));
            await expect(votingSystem.connect(voter1).castVote(2, 0, freshNullifier))
                .to.emit(votingSystem, "VoteCast")
                .withArgs(2, 0, freshNullifier, voter1.address, anyValue);

            const updatedCands = await votingSystem.getCandidates(2);
            expect(updatedCands[0].voteCount).to.equal(1);
        });

        it("should reject re-election creation if parent election is not annulled", async function () {
            // Election 1 is OPEN, not ANNULLED
            await expect(
                votingSystem.createReElection(1, "Premature re-election")
            ).to.be.revertedWith("VotingSystem: Parent election must be annulled before re-election");
        });
    });
});
