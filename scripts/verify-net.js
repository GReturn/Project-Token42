const { ethers } = require("hardhat");

async function main() {
    const network = await ethers.provider.getNetwork();
    console.log("Network Name:", network.name);
    console.log("EVM Chain ID:", network.chainId.toString());
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "PAS");
}

main().catch(console.error);
