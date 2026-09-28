const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8546';
const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY; // The relayer wallet

let contract = null;
let provider = null;
let wallet = null;

try {
    const modernArtifactPath = path.resolve(__dirname, '../artifacts/contracts/VotingSystem.sol/VotingSystem.json');
    const legacyArtifactPath = path.resolve(__dirname, '../artifacts/contracts/Voting.sol/Voting.json');

    const artifactPath = fs.existsSync(modernArtifactPath) ? modernArtifactPath : legacyArtifactPath;

    if (fs.existsSync(artifactPath)) {
        const VotingArtifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        provider = new ethers.JsonRpcProvider(RPC_URL);
        
        if (PRIVATE_KEY && CONTRACT_ADDRESS) {
            wallet = new ethers.Wallet(PRIVATE_KEY, provider);
            contract = new ethers.Contract(CONTRACT_ADDRESS, VotingArtifact.abi, wallet);
            console.log("[Blockchain] Relayer initialized with contract at", CONTRACT_ADDRESS);
            console.log("[Blockchain] RPC URL:", RPC_URL);
            console.log("[Blockchain] Relayer Wallet address:", wallet.address);
        } else {
            console.warn("[Blockchain] ADMIN_PRIVATE_KEY or CONTRACT_ADDRESS not provided. Write operations will fail.");
            if (CONTRACT_ADDRESS) {
                contract = new ethers.Contract(CONTRACT_ADDRESS, VotingArtifact.abi, provider);
            }
        }
    } else {
        console.warn("[Blockchain] Contract artifacts not found. Please compile the hardhat project.");
    }
} catch (error) {
    console.error("[Blockchain] Error initializing blockchain connection:", error);
}

module.exports = { contract, provider, wallet };
