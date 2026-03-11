const { ethers } = require("hardhat");

async function main() {
    const address = "0x375ac89e80AE2169EC049B5780831A58bab5f7e3"; // input your public address to your wallet here
    const balance = await ethers.provider.getBalance(address);
    console.log("Address:", address);
    console.log("Balance:", ethers.formatEther(balance), "PAS");
}

main().catch(console.error);
