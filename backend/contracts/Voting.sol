// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {
    address public admin;

    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 votedCandidateId;
    }

    enum ElectionState { NotStarted, Ongoing, Ended }
    ElectionState public state;

    mapping(address => Voter) public voters;
    Candidate[] public candidates;
    uint256 public candidatesCount;

    event VoterRegistered(address voter);
    event CandidateAdded(uint256 candidateId, string name);
    event ElectionStarted();
    event ElectionEnded();
    event VoteCast(address voter, uint256 candidateId, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier inState(ElectionState _state) {
        require(state == _state, "Invalid election state for this action");
        _;
    }

    constructor(address _admin) {
        admin = _admin;
        state = ElectionState.NotStarted;
    }

    function addCandidate(string memory _name) public onlyAdmin inState(ElectionState.NotStarted) {
        candidates.push(Candidate({
            id: candidatesCount,
            name: _name,
            voteCount: 0
        }));
        emit CandidateAdded(candidatesCount, _name);
        candidatesCount++;
    }

    function registerVoter(address _voter) public onlyAdmin inState(ElectionState.NotStarted) {
        require(!voters[_voter].isRegistered, "Voter is already registered");
        voters[_voter].isRegistered = true;
        emit VoterRegistered(_voter);
    }

    function startElection() public onlyAdmin inState(ElectionState.NotStarted) {
        state = ElectionState.Ongoing;
        emit ElectionStarted();
    }

    function endElection() public onlyAdmin inState(ElectionState.Ongoing) {
        state = ElectionState.Ended;
        emit ElectionEnded();
    }

    function vote(uint256 _candidateId) public inState(ElectionState.Ongoing) {
        require(voters[msg.sender].isRegistered, "You must be a registered voter");
        require(!voters[msg.sender].hasVoted, "You have already voted");
        require(_candidateId < candidatesCount, "Invalid candidate ID");

        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedCandidateId = _candidateId;
        candidates[_candidateId].voteCount++;

        emit VoteCast(msg.sender, _candidateId, block.timestamp);
    }

    function getCandidates() public view returns (Candidate[] memory) {
        return candidates;
    }

    // Allow Relayer (Admin) to vote on behalf of a verified off-chain user
    function adminVote(uint256 _candidateId) public onlyAdmin inState(ElectionState.Ongoing) {
        require(_candidateId < candidatesCount, "Invalid candidate ID");
        
        candidates[_candidateId].voteCount++;
        emit VoteCast(msg.sender, _candidateId, block.timestamp);
    }
}
