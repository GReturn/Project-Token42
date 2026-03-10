const { ethers } = require("hardhat");

async function main() {
    const feeData = await ethers.provider.getFeeData();
    console.log("Gas Price:", ethers.utils?.formatUnits(feeData.gasPrice, "gwei") || ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");
}

main().catch(console.error);
