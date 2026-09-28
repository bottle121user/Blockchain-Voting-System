const { expect } = require("chai");

describe("Voting Contract", function () {
    let Voting;
    let voting;
    let owner;
    let addr1;
    let addr2;

    beforeEach(async function () {
        Voting = await ethers.getContractFactory("Voting");
        [owner, addr1, addr2] = await ethers.getSigners();
        voting = await Voting.deploy(owner.address);
    });

    describe("Deployment", function () {
        it("Should set the right admin", async function () {
            expect(await voting.admin()).to.equal(owner.address);
        });

        it("Should start in NotStarted state", async function () {
            expect(await voting.state()).to.equal(0); // NotStarted
        });
    });

    describe("Candidate Management", function () {
        it("Should add a candidate", async function () {
            await voting.addCandidate("Alice");
            const candidates = await voting.getCandidates();
            expect(candidates[0].name).to.equal("Alice");
            expect(candidates[0].voteCount).to.equal(0);
        });

        it("Should not allow non-admin to add candidates", async function () {
            await expect(voting.connect(addr1).addCandidate("Bob"))
                .to.be.revertedWith("Only admin can perform this action");
        });

        it("Should not allow adding candidates after election starts", async function () {
            await voting.startElection();
            await expect(voting.addCandidate("Bob"))
                .to.be.revertedWith("Invalid election state for this action");
        });
    });

    describe("Voter Registration", function () {
        it("Should allow admin to register voters", async function () {
            await voting.registerVoter(addr1.address);
            const voter = await voting.voters(addr1.address);
            expect(voter.isRegistered).to.equal(true);
        });

        it("Should not allow double registration", async function () {
            await voting.registerVoter(addr1.address);
            await expect(voting.registerVoter(addr1.address))
                .to.be.revertedWith("Voter is already registered");
        });

        it("Should not allow registration after election starts", async function () {
            await voting.startElection();
            await expect(voting.registerVoter(addr1.address))
                .to.be.revertedWith("Invalid election state for this action");
        });
    });

    describe("Voting Logic", function () {
        beforeEach(async function () {
            await voting.addCandidate("Alice");
            await voting.addCandidate("Bob");
            await voting.registerVoter(addr1.address);
        });

        it("Should not allow voting before election starts", async function () {
            await expect(voting.connect(addr1).vote(0))
                .to.be.revertedWith("Invalid election state for this action");
        });

        it("Should allow voting during ongoing election", async function () {
            await voting.startElection();
            await voting.connect(addr1).vote(0);
            const candidates = await voting.getCandidates();
            expect(candidates[0].voteCount).to.equal(1);
        });

        it("Should prevent double voting", async function () {
            await voting.startElection();
            await voting.connect(addr1).vote(0);
            await expect(voting.connect(addr1).vote(1))
                .to.be.revertedWith("You have already voted");
        });

        it("Should revert on invalid candidate ID", async function () {
            await voting.startElection();
            await expect(voting.connect(addr1).vote(99))
                .to.be.revertedWith("Invalid candidate ID");
        });

        it("Should not allow voting after election ends", async function () {
            await voting.startElection();
            await voting.endElection();
            await expect(voting.connect(addr1).vote(0))
                .to.be.revertedWith("Invalid election state for this action");
        });
    });

    describe("Relayer (Admin) Voting", function () {
        beforeEach(async function () {
            await voting.addCandidate("Alice");
            await voting.startElection();
        });

        it("Should allow admin to vote on behalf of users", async function () {
            await voting.adminVote(0);
            const candidates = await voting.getCandidates();
            expect(candidates[0].voteCount).to.equal(1);
        });

        it("Should not allow non-admin to use adminVote", async function () {
            await expect(voting.connect(addr1).adminVote(0))
                .to.be.revertedWith("Only admin can perform this action");
        });
    });
});
