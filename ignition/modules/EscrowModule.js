const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("EscrowModule", (m) => {
    // These addresses are already deployed on Paseo Asset Hub
    const rUSDAddress = m.getParameter("rUSDAddress", "0x454b00B17f45fe3Fa0d7B456742a1d48726FF593");
    const profileAddress = m.getParameter("profileAddress", "0xD7dD2d357A377beb0bbF89BfF0f0b36549e8476B");

    const escrow = m.contract("Token42Escrow", [rUSDAddress, profileAddress]);

    return { escrow };
});
