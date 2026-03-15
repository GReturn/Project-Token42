const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying updated Token42Messaging with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // Address of the existing RUSD token from .env
    const EXISTING_RUSD = "0x204d03b7d344a7Df4e06c1c5FC023C489542Db02"; 
    // Address of the existing Profile contract
    const EXISTING_PROFILE = "0xC481c1B4998148124aF7792eC6DB824cF6b467C0";
    // Address of the AI Agent (often the deployer or static key)
    const AI_AGENT = deployer.address; 

    try {
        const Token42Messaging = await ethers.getContractFactory("Token42Messaging");
        console.log("Deploying Token42Messaging...");
        
        // Pass 3 arguments
        const messaging = await Token42Messaging.deploy(EXISTING_RUSD, EXISTING_PROFILE, AI_AGENT);
        await messaging.waitForDeployment();
        
        const deployedAddress = await messaging.getAddress();
        console.log("\n✅ Token42Messaging deployed to:", deployedAddress);
        console.log("\n⚠️ Update your .env files with this address:");
        console.log(`MESSAGING_CONTRACT_ADDRESS="${deployedAddress}"`);
        console.log(`VITE_MESSAGING_CONTRACT_ADDRESS="${deployedAddress}"`);

    } catch (error) {
        console.error("❌ Deployment failed:", error);
    }
}

main().catch(console.error);
