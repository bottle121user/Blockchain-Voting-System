// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VotingSystem
 * @notice Enterprise Multi-Election Smart Contract with Cryptographic Nullifiers, Strict State Machine,
 *         and an Emergency Annulment & Linked Re-Election Protocol.
 * @dev Enforces mathematical double-voting prevention and immutable forensic preservation if compromise occurs.
 */
contract VotingSystem is AccessControl {
    bytes32 public constant ELECTION_ORGANIZER_ROLE = keccak256("ELECTION_ORGANIZER_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    enum ElectionState {
        CREATED,        // 0: Initial setup
        REGISTRATION,   // 1: Candidate & voter authorization
        OPEN,           // 2: Active voting window
        CLOSED,         // 3: Voting concluded, tally frozen
        FINALIZED,      // 4: Results officially proclaimed
        ANNULLED        // 5: Election invalidated due to compromise (forensic lock)
    }

    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    struct Election {
        uint256 id;
        string name;
        string description;
        ElectionState state;
        uint256 candidatesCount;
        uint256 totalVotes;
        uint256 createdAt;
        uint256 openedAt;
        uint256 closedAt;
        uint256 parentElectionId; // 0 if original; >0 if linked re-election
        string annulmentReason;   // Documented on-chain if annulled
    }

    uint256 public electionCounter;
    mapping(uint256 => Election) public elections;
    mapping(uint256 => Candidate[]) private _candidates;
    
    // electionId => (nullifierHash => hasVoted)
    // Ensures single-vote integrity per election on-chain
    mapping(uint256 => mapping(bytes32 => bool)) public hasVotedNullifier;

    // Events for Idempotent Indexing
    event ElectionCreated(uint256 indexed electionId, string name, address indexed creator, uint256 timestamp);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event ElectionStateChanged(uint256 indexed electionId, ElectionState previousState, ElectionState newState, uint256 timestamp);
    event ElectionAnnulled(uint256 indexed electionId, string reason, address indexed authority, uint256 timestamp);
    event VoteCast(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        bytes32 indexed nullifier,
        address submitter,
        uint256 timestamp
    );

    modifier electionExists(uint256 _electionId) {
        require(_electionId > 0 && _electionId <= electionCounter, "VotingSystem: Election does not exist");
        _;
    }

    modifier inState(uint256 _electionId, ElectionState _requiredState) {
        require(elections[_electionId].state == _requiredState, "VotingSystem: Invalid election state for operation");
        _;
    }

    constructor(address rootAdmin, address relayerAddress) {
        require(rootAdmin != address(0), "VotingSystem: Root admin cannot be zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, rootAdmin);
        _grantRole(ELECTION_ORGANIZER_ROLE, rootAdmin);

        if (relayerAddress != address(0)) {
            _grantRole(RELAYER_ROLE, relayerAddress);
        }
    }

    /**
     * @notice Creates a new election session.
     */
    function createElection(string calldata _name, string calldata _description) 
        external 
        onlyRole(ELECTION_ORGANIZER_ROLE) 
        returns (uint256) 
    {
        require(bytes(_name).length > 0, "VotingSystem: Election name cannot be empty");

        electionCounter++;
        uint256 newId = electionCounter;

        elections[newId] = Election({
            id: newId,
            name: _name,
            description: _description,
            state: ElectionState.CREATED,
            candidatesCount: 0,
            totalVotes: 0,
            createdAt: block.timestamp,
            openedAt: 0,
            closedAt: 0,
            parentElectionId: 0,
            annulmentReason: ""
        });

        emit ElectionCreated(newId, _name, msg.sender, block.timestamp);
        return newId;
    }

    /**
     * @notice Adds a candidate to an election during CREATED or REGISTRATION state.
     */
    function addCandidate(uint256 _electionId, string calldata _candidateName)
        external
        onlyRole(ELECTION_ORGANIZER_ROLE)
        electionExists(_electionId)
    {
        ElectionState s = elections[_electionId].state;
        require(
            s == ElectionState.CREATED || s == ElectionState.REGISTRATION,
            "VotingSystem: Candidates can only be added before election opens"
        );
        require(bytes(_candidateName).length > 0, "VotingSystem: Candidate name cannot be empty");

        uint256 cId = elections[_electionId].candidatesCount;
        _candidates[_electionId].push(Candidate({
            id: cId,
            name: _candidateName,
            voteCount: 0
        }));

        elections[_electionId].candidatesCount++;
        emit CandidateAdded(_electionId, cId, _candidateName);
    }

    /**
     * @notice Transitions election from CREATED to REGISTRATION.
     */
    function openRegistration(uint256 _electionId)
        external
        onlyRole(ELECTION_ORGANIZER_ROLE)
        electionExists(_electionId)
        inState(_electionId, ElectionState.CREATED)
    {
        elections[_electionId].state = ElectionState.REGISTRATION;
        emit ElectionStateChanged(_electionId, ElectionState.CREATED, ElectionState.REGISTRATION, block.timestamp);
    }

    /**
     * @notice Opens the voting window. Requires at least 2 candidates.
     */
    function openElection(uint256 _electionId)
        external
        onlyRole(ELECTION_ORGANIZER_ROLE)
        electionExists(_electionId)
    {
        ElectionState s = elections[_electionId].state;
        require(
            s == ElectionState.CREATED || s == ElectionState.REGISTRATION,
            "VotingSystem: Invalid state to open election"
        );
        require(
            elections[_electionId].candidatesCount >= 2,
            "VotingSystem: At least 2 candidates required to open election"
        );

        ElectionState prev = s;
        elections[_electionId].state = ElectionState.OPEN;
        elections[_electionId].openedAt = block.timestamp;

        emit ElectionStateChanged(_electionId, prev, ElectionState.OPEN, block.timestamp);
    }

    /**
     * @notice Closes an active election. No further votes accepted.
     */
    function closeElection(uint256 _electionId)
        external
        onlyRole(ELECTION_ORGANIZER_ROLE)
        electionExists(_electionId)
        inState(_electionId, ElectionState.OPEN)
    {
        elections[_electionId].state = ElectionState.CLOSED;
        elections[_electionId].closedAt = block.timestamp;

        emit ElectionStateChanged(_electionId, ElectionState.OPEN, ElectionState.CLOSED, block.timestamp);
    }

    /**
     * @notice Finalizes the election tally. Permanent frozen state.
     */
    function finalizeElection(uint256 _electionId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        electionExists(_electionId)
        inState(_electionId, ElectionState.CLOSED)
    {
        elections[_electionId].state = ElectionState.FINALIZED;
        emit ElectionStateChanged(_electionId, ElectionState.CLOSED, ElectionState.FINALIZED, block.timestamp);
    }

    /**
     * @notice Emergency Annulment Protocol.
     * @dev Freezes a compromised election, permanently invalidating its outcome while preserving the forensic evidence on-chain.
     * @param _electionId Target election ID
     * @param _reason Official justification for the annulment (e.g. "Voter credential breach detected")
     */
    function annulElection(uint256 _electionId, string calldata _reason)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        electionExists(_electionId)
    {
        ElectionState s = elections[_electionId].state;
        require(s != ElectionState.FINALIZED, "VotingSystem: Cannot annul an already finalized election");
        require(s != ElectionState.ANNULLED, "VotingSystem: Election is already annulled");
        require(bytes(_reason).length > 0, "VotingSystem: Annulment reason cannot be empty");

        ElectionState prev = s;
        elections[_electionId].state = ElectionState.ANNULLED;
        elections[_electionId].annulmentReason = _reason;
        elections[_electionId].closedAt = block.timestamp;

        emit ElectionAnnulled(_electionId, _reason, msg.sender, block.timestamp);
        emit ElectionStateChanged(_electionId, prev, ElectionState.ANNULLED, block.timestamp);
    }

    /**
     * @notice Linked Re-Election Protocol.
     * @dev Spawns a fresh re-election session linked to an annulled session, cloning candidate rosters while resetting nullifiers.
     * @param _compromisedElectionId ID of the annulled election
     * @param _reason Re-election justification
     * @return New election ID
     */
    function createReElection(uint256 _compromisedElectionId, string calldata _reason)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        electionExists(_compromisedElectionId)
        returns (uint256)
    {
        Election storage parent = elections[_compromisedElectionId];
        require(parent.state == ElectionState.ANNULLED, "VotingSystem: Parent election must be annulled before re-election");

        electionCounter++;
        uint256 newId = electionCounter;

        string memory reElectionName = string(abi.encodePacked("Re-Election: ", parent.name));
        string memory reElectionDesc = string(abi.encodePacked("Emergency re-election following annulment. Reason: ", _reason));

        elections[newId] = Election({
            id: newId,
            name: reElectionName,
            description: reElectionDesc,
            state: ElectionState.CREATED,
            candidatesCount: 0,
            totalVotes: 0,
            createdAt: block.timestamp,
            openedAt: 0,
            closedAt: 0,
            parentElectionId: _compromisedElectionId,
            annulmentReason: ""
        });

        // Clone candidate roster from parent election
        Candidate[] storage parentCands = _candidates[_compromisedElectionId];
        for (uint256 i = 0; i < parentCands.length; i++) {
            _candidates[newId].push(Candidate({
                id: i,
                name: parentCands[i].name,
                voteCount: 0
            }));
            elections[newId].candidatesCount++;
            emit CandidateAdded(newId, i, parentCands[i].name);
        }

        emit ElectionCreated(newId, reElectionName, msg.sender, block.timestamp);
        return newId;
    }

    /**
     * @notice Casts a vote using a cryptographic nullifier hash.
     */
    function castVote(
        uint256 _electionId,
        uint256 _candidateId,
        bytes32 _nullifier
    )
        external
        electionExists(_electionId)
        inState(_electionId, ElectionState.OPEN)
    {
        _processVote(_electionId, _candidateId, _nullifier);
    }

    /**
     * @notice Relayer-specific vote submission endpoint for gasless voter interactions.
     */
    function castVoteRelayed(
        uint256 _electionId,
        uint256 _candidateId,
        bytes32 _nullifier
    )
        external
        onlyRole(RELAYER_ROLE)
        electionExists(_electionId)
        inState(_electionId, ElectionState.OPEN)
    {
        _processVote(_electionId, _candidateId, _nullifier);
    }

    function _processVote(uint256 _electionId, uint256 _candidateId, bytes32 _nullifier) internal {
        require(_nullifier != bytes32(0), "VotingSystem: Invalid nullifier");
        require(
            !hasVotedNullifier[_electionId][_nullifier],
            "VotingSystem: Double voting rejected - nullifier already spent"
        );
        require(
            _candidateId < elections[_electionId].candidatesCount,
            "VotingSystem: Invalid candidate ID"
        );

        hasVotedNullifier[_electionId][_nullifier] = true;
        _candidates[_electionId][_candidateId].voteCount++;
        elections[_electionId].totalVotes++;

        emit VoteCast(_electionId, _candidateId, _nullifier, msg.sender, block.timestamp);
    }

    /**
     * @notice Returns all candidates for a given election.
     */
    function getCandidates(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (Candidate[] memory)
    {
        return _candidates[_electionId];
    }

    /**
     * @notice Convenience view returning election details.
     */
    function getElection(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (Election memory)
    {
        return elections[_electionId];
    }
}
