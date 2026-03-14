const { ethers } = require("hardhat");

async function main() {
    const PROFILE_ADDRESS = "0x9B9f7569A535Cd2B66EC9B2F5509F5e688Ba92B5";
    const ABI = ["function ownerOf(uint256) view returns (address)", "function getProfileCID(address) view returns (string)", "function hasProfile(address) view returns (bool)"];
    
    const [deployer] = await ethers.getSigners();
    const profile = new ethers.Contract(PROFILE_ADDRESS, ABI, deployer);

    console.log("Checking profiles...");
    for(let i=1; i<=5; i++) {
        try {
            const owner = await profile.ownerOf(i);
            const cid = await profile.getProfileCID(owner);
            console.log(`Token ${i}: Owner ${owner}, CID ${cid}`);
        } catch (e) {
            console.log(`Token ${i}: Does not exist`);
        }
    }
    
    const userA = "0x375ac89e80AE2169EC049B5780831A58bab5f7e3";
    const userB = "0x2e01d43D8a9C06D78eCbbf6A5dd9e635cB5A78C9";
    
    console.log(`User A (${userA}) has profile: ${await profile.hasProfile(userA)}`);
    console.log(`User B (${userB}) has profile: ${await profile.hasProfile(userB)}`);
}

main().catch(console.error);
