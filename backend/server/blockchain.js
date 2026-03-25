const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY; // The relayer wallet

let contract = null;
let provider = null;
let wallet = null;

try {
    const contractJsonPath = path.resolve(__dirname, '../artifacts/contracts/Voting.sol/Voting.json');
    if (fs.existsSync(contractJsonPath)) {
        const VotingArtifact = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
        provider = new ethers.JsonRpcProvider(RPC_URL);
        
        if (PRIVATE_KEY && CONTRACT_ADDRESS) {
            wallet = new ethers.Wallet(PRIVATE_KEY, provider);
            contract = new ethers.Contract(CONTRACT_ADDRESS, VotingArtifact.abi, wallet);
            console.log("Blockchain Relayer initialized with standard contract at", CONTRACT_ADDRESS);
            console.log("RPC URL:", RPC_URL);
            console.log("Wallet address:", wallet.address);
        } else {
            console.warn("ADMIN_PRIVATE_KEY or CONTRACT_ADDRESS not provided. Write operations will fail.");
            if (CONTRACT_ADDRESS) {
                contract = new ethers.Contract(CONTRACT_ADDRESS, VotingArtifact.abi, provider);
            }
        }
    } else {
        console.warn("Contract artifacts not found. Please compile the hardhat project (`npx hardhat compile`).");
    }
} catch (error) {
    console.error("Error initializing blockchain connection:", error);
}

module.exports = { contract, provider, wallet };
