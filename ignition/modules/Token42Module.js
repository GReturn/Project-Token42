const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const USE_MOCKS = process.env.USE_MOCKS !== "false"; 

module.exports = buildModule("Token42Module", (m) => {
    let identityAddress;
    let rUSDAddress;

    if (USE_MOCKS) {
        // Dev/Hackathon Mode: Deploy and use local mocks
        identityAddress = m.contract("MockIdentityPrecompile", []);
        rUSDAddress = m.contract("MockRUSD", []);
    } else {
        // Production Mode: Use real parameters
        identityAddress = m.getParameter("identityPrecompileAddress", "0x0000000000000000000000000000000000000901");
        rUSDAddress = m.getParameter("rUSDAddress", "0x0000000000000000000000000000000000000000"); 
    }

    // AI Agent: Admin address for the messaging contract
    const aiAgent = m.getParameter("aiAgentAddress", "0x375ac89e80AE2169EC049B5780831A58bab5f7e3");

    // Deploy Token42Profile (Soulbound)
    const profile = m.contract("Token42Profile", [identityAddress]);

    // Deploy Token42Messaging
    const messaging = m.contract("Token42Messaging", [rUSDAddress, profile, aiAgent]);

    // Deploy Token42Escrow
    const escrow = m.contract("Token42Escrow", [rUSDAddress, profile]);

    if (USE_MOCKS) {
        return { profile, messaging, escrow, identityAddress, rUSDAddress };
    }
    return { profile, messaging, escrow };
});
