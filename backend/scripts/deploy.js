const hre = require("hardhat");

async function main() {
    console.log("Starting deployment...");
    
    // Get the account from .env to be the Admin
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
        throw new Error("ADMIN_PRIVATE_KEY not found in .env");
    }
    const adminWallet = new hre.ethers.Wallet(adminPrivateKey);
    console.log("Contract Admin will be:", adminWallet.address);

    // Deploy with the default Hardhat account (Acc 0)
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contract with account:", deployer.address);

    const Voting = await hre.ethers.getContractFactory("Voting", deployer);
    const voting = await Voting.deploy(adminWallet.address);
    await voting.waitForDeployment();

    const address = await voting.getAddress();
    console.log("Voting contract deployed to:", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
