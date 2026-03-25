const { ethers } = require('ethers');
require('dotenv').config();

async function check() {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
    const privateKey = process.env.ADMIN_PRIVATE_KEY;
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const balance = await provider.getBalance(wallet.address);
    const nonce = await provider.getTransactionCount(wallet.address);
    const chainId = (await provider.getNetwork()).chainId;

    console.log("Account:", wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");
    console.log("Nonce:", nonce);
    console.log("Chain ID:", chainId.toString());
}

check().catch(console.error);
