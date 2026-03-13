const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("MocksModule", (m) => {
    const mockIdentity = m.contract("MockIdentityPrecompile", []);
    const mockRUSD = m.contract("MockRUSD", []);
    return { mockIdentity, mockRUSD };
});
