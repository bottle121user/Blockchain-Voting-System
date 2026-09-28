const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting deployment of enterprise VotingSystem contract...");

    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
        throw new Error("ADMIN_PRIVATE_KEY not found in .env");
    }

    const adminWallet = new hre.ethers.Wallet(adminPrivateKey);
    console.log("Contract Admin & Relayer will be:", adminWallet.address);

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contract using account:", deployer.address);

    const VotingSystem = await hre.ethers.getContractFactory("VotingSystem", deployer);
    // Grant DEFAULT_ADMIN_ROLE and RELAYER_ROLE to adminWallet.address
    const votingSystem = await VotingSystem.deploy(adminWallet.address, adminWallet.address);
    await votingSystem.waitForDeployment();

    const contractAddress = await votingSystem.getAddress();
    console.log("VotingSystem contract deployed to:", contractAddress);

    // Update .env file with new contract address
    const envPath = path.resolve(__dirname, "../.env");
    let envContent = fs.readFileSync(envPath, "utf8");
    envContent = envContent.replace(/CONTRACT_ADDRESS=".*"/, `CONTRACT_ADDRESS="${contractAddress}"`);
    fs.writeFileSync(envPath, envContent);
    console.log("Updated .env CONTRACT_ADDRESS to:", contractAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
