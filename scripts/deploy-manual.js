const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    try {
        const Token42Profile = await ethers.getContractFactory("Token42Profile");
        console.log("Deploying Token42Profile...");
        const profile = await Token42Profile.deploy();
        await profile.waitForDeployment();
        console.log("Token42Profile deployed to:", await profile.getAddress());

        const MockRUSD = await ethers.getContractFactory("MockRUSD");
        console.log("Deploying MockRUSD...");
        const rusd = await MockRUSD.deploy();
        await rusd.waitForDeployment();
        const rusdAddress = await rusd.getAddress();
        console.log("MockRUSD deployed to:", rusdAddress);

        const Token42Messaging = await ethers.getContractFactory("Token42Messaging");
        console.log("Deploying Token42Messaging...");
        const messaging = await Token42Messaging.deploy(rusdAddress, deployer.address); // Use deployer as AI agent for now
        await messaging.waitForDeployment();
        console.log("Token42Messaging deployed to:", await messaging.getAddress());
    } catch (error) {
        console.error("Deployment failed:", error);
    }
}

main().catch(console.error);
