const hre = require("hardhat");

async function main() {
    const userA = "0x375ac89e80AE2169EC049B5780831A58bab5f7e3";
    const userB = "0x2e01d43D8a9C06D78eCbbf6A5dd9e635cB5A78C9";
    const score = 9709;
    const signature = "0x56bcb00964e67b51235873b126c36e071dac1a259fff7e3a67a012fbdc0c2daa3e984d159fbf6ea0eae0dc1949a55a1f5f834616db8e1f6798ef08676eb8b7091b";

    console.log("--- Signature Analysis ---");
    
    const tryParams = (uA, uB, s, n) => {
        const messageHash = hre.ethers.solidityPackedKeccak256(
            ['address', 'address', 'uint256', 'uint256'],
            [uA, uB, s, n]
        );
        const ethSignedHash = hre.ethers.hashMessage(hre.ethers.getBytes(messageHash));
        return hre.ethers.recoverAddress(ethSignedHash, signature);
    };

    for (let n = 0; n < 5; n++) {
        const recovered = tryParams(userA, userB, score, n);
        console.log(`Nonce ${n}: Recovered ${recovered}`);
        if (recovered.toLowerCase() === userA.toLowerCase()) console.log(">>> MATCH FOUND!");
    }

    console.log("\n--- Contract State Check ---");
    const messagingAddress = "0x0746242E447fAec6E2eAB20184631E65bf33be0d";
    const messaging = await hre.ethers.getContractAt("Token42Messaging", messagingAddress);
    
    const owner = await messaging.owner();
    console.log("Contract Owner:", owner);
    
    const isAgentAdmin = await messaging.isAdmin(userA);
    console.log(`Is Agent (${userA}) Admin?:`, isAgentAdmin);
    
    const currentNonce = await messaging.nonces(userA);
    console.log(`Current Nonce for ${userA}:`, currentNonce.toString());
}

main().catch(console.error);
