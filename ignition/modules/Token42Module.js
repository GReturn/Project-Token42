const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("Token42Module", (m) => {
    // Deploy Token42Profile (Soulbound)
    const identityPrecompile = m.getParameter("identityPrecompile", "0x0000000000000000000000000000000000000901");
    const profile = m.contract("Token42Profile", [identityPrecompile]);

    // For Token42Messaging, we need rUSD address and AI Agent address.
    // Use parameters so they can be configured per-network.
    const rUSD = m.getParameter("rUSD", "0x0000000000000000000000000000000000000000");
    const aiAgent = m.getParameter("aiAgent", "0x0000000000000000000000000000000000000000");

    const messaging = m.contract("Token42Messaging", [rUSD, profile, aiAgent]);

    return { profile, messaging };
});
