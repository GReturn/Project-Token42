const hre = require("hardhat");

async function main() {
    const messagingAddress = "0x0746242E447fAec6E2eAB20184631E65bf33be0d";
    const userA = "0x375ac89e80AE2169EC049B5780831A58bab5f7e3";
    const userB = "0x2e01d43D8a9C06D78eCbbf6A5dd9e635cB5A78C9";
    const score = 9709;
    const nonce = 0;
    
    // The signature from the error log
    const signature = "0x56bcb00964e67b51235873b126c36e071dac1a259fff7e3a67a012fbdc0c2daa3e984d159fbf6ea0eae0dc1949a55a1f5f834616db8e1f6798ef08676eb8b7091b";

    console.log("Debugging Signature Recovery...");
    console.log("Expected Signer (Agent):", userA);

    for (let n = 0; n < 10; n++) {
        const messageHash = hre.ethers.solidityPackedKeccak256(
            ['address', 'address', 'uint256', 'uint256'],
            [userA, userB, score, n]
        );
        const ethSignedHash = hre.ethers.hashMessage(hre.ethers.getBytes(messageHash));
        const recoveredAddress = hre.ethers.recoverAddress(ethSignedHash, signature);
        
        console.log(`Nonce ${n}: Recovered ${recoveredAddress}`);
        if (recoveredAddress.toLowerCase() === userA.toLowerCase()) {
            console.log(`✅ MATCH FOUND AT NONCE ${n}!`);
            return;
        }
    }

    // Try swapped addresses
    console.log("\nTrying swapped addresses...");
    for (let n = 0; n < 10; n++) {
        const messageHash = hre.ethers.solidityPackedKeccak256(
            ['address', 'address', 'uint256', 'uint256'],
            [userB, userA, score, n]
        );
        const ethSignedHash = hre.ethers.hashMessage(hre.ethers.getBytes(messageHash));
        const recoveredAddress = hre.ethers.recoverAddress(ethSignedHash, signature);
        
        console.log(`Swapped Nonce ${n}: Recovered ${recoveredAddress}`);
        if (recoveredAddress.toLowerCase() === userA.toLowerCase()) {
            console.log(`✅ MATCH FOUND (Swapped) AT NONCE ${n}!`);
            return;
        }
    }

    console.log("❌ NO MATCH FOUND.");
}

main().catch(console.error);
