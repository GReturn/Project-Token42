require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");
const { vars } = require("hardhat/config");

module.exports = {
    solidity: "0.8.28",
    resolc: { version: "0.3.0", compilerSource: "npm" },
    networks: {
        hardhat: {
            polkavm: true,
        },
        passetHub: {
            polkavm: true,
            url: "https://eth-rpc-testnet.polkadot.io",
            accounts: [vars.get("PRIVATE_KEY")],
        },
    },
};
