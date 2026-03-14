const hre = require("hardhat");

async function main() {
    const USE_MOCKS = process.env.USE_MOCKS !== "false";
    console.log("Starting deployment...");
    console.log("USE_MOCKS =", USE_MOCKS);

    let identityAddress;
    let rUSDAddress;

    // The Paseo network routinely throws "Priority is too low: (1 vs 1)"
    // We override the gas fees to manually force the transaction through.
    const feeData = await hre.ethers.provider.getFeeData();
    const gasOverrides = {
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n || hre.ethers.parseUnits("2", "gwei"),
        maxFeePerGas: feeData.maxFeePerGas * 2n || hre.ethers.parseUnits("3", "gwei")
    };

    if (USE_MOCKS) {
        console.log(`Overriding gas fees... maxPriority: ${gasOverrides.maxPriorityFeePerGas}`);
        
        console.log("Deploying MockIdentityPrecompile...");
        const MockIdentity = await hre.ethers.getContractFactory("MockIdentityPrecompile");
        const mockIdentity = await MockIdentity.deploy(gasOverrides);
        await mockIdentity.waitForDeployment();
        identityAddress = await mockIdentity.getAddress();
        console.log("MockIdentityPrecompile deployed to:", identityAddress);

        console.log("Deploying MockRUSD...");
        const MockRUSD = await hre.ethers.getContractFactory("MockRUSD");
        const mockRUSD = await MockRUSD.deploy(gasOverrides);
        await mockRUSD.waitForDeployment();
        rUSDAddress = await mockRUSD.getAddress();
        console.log("MockRUSD deployed to:", rUSDAddress);
    } else {
        console.log("Using production addresses...");
        identityAddress = "0x0000000000000000000000000000000000000901";
        // Update this with the real rUSD address on Paseo when moving to production
        rUSDAddress = "0x0000000000000000000000000000000000000000"; 
    }

    const aiAgentAddress = "0x375ac89e80AE2169EC049B5780831A58bab5f7e3";

    console.log("Deploying Token42Profile...");
    const Token42Profile = await hre.ethers.getContractFactory("Token42Profile");
    const profile = await Token42Profile.deploy(identityAddress, gasOverrides);
    await profile.waitForDeployment();
    const profileAddress = await profile.getAddress();        console.log("Token42Profile deployed to:", profileAddress);

        console.log("Deploying Token42Messaging...");
        const Token42Messaging = await hre.ethers.getContractFactory("Token42Messaging");
        const messaging = await Token42Messaging.deploy(rUSDAddress, profileAddress, aiAgentAddress, gasOverrides);
        await messaging.waitForDeployment();
        const messagingAddress = await messaging.getAddress();
        console.log("Token42Messaging deployed to:", messagingAddress);

        console.log("Deploying Token42Escrow...");
        const Token42Escrow = await hre.ethers.getContractFactory("Token42Escrow");
        const escrow = await Token42Escrow.deploy(rUSDAddress, profileAddress, gasOverrides);
        await escrow.waitForDeployment();
        const escrowAddress = await escrow.getAddress();
        console.log("Token42Escrow deployed to:", escrowAddress);

        console.log("\n=== Deployment Complete ===");
        console.log("Token42Profile:", profileAddress);
        console.log("Token42Messaging:", messagingAddress);
        console.log("Token42Escrow:", escrowAddress);
        console.log("MockRUSD:", rUSDAddress);
    }
    
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
