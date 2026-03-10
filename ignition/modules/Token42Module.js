const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("Token42Module", (m) => {
    // Deploy Token42Profile (Soulbound)
    const profile = m.contract("Token42Profile");

    // For Token42Messaging, we need rUSD address and AI Agent address.
    // Use parameters so they can be configured per-network.
    const rUSD = m.getParameter("rUSD", "0x0000000000000000000000000000000000000000");
    const aiAgent = m.getParameter("aiAgent", "0x0000000000000000000000000000000000000000");

    const messaging = m.contract("Token42Messaging", [rUSD, aiAgent]);

    return { profile, messaging };
});
