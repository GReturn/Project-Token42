# 💎 Token42 — Polkadot Smart Contract Development Guide

Build the **Token42 decentralized AI dating platform** on Polkadot Hub using **Kitdot** and **Hardhat**.

---

## 🚀 Quick Start

### Option A: DevContainer (RECOMMENDED)

A batteries-included environment. No manual tool installation.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop) + [VS Code Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

1. Open this project in VS Code
2. Click **"Reopen in Container"** when prompted
3. The container installs Node.js 22, Foundry, `subkey`, and generates a deployment keypair

The devcontainer auto-detects your project type (Hardhat or Foundry) and configures accordingly.

### Option B: Kitdot CLI

```bash
npm install -g kitdot
kitdot init token42
cd token42
```

Kitdot scaffolds a Hardhat project pre-configured for PolkaVM with correct network settings.

### Option C: Manual Hardhat Setup

```bash
npm install --save-dev @parity/hardhat-polkadot solc@0.8.28
npm install --force @nomicfoundation/hardhat-toolbox
npx hardhat-polkadot init
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vite)                  │
│        Wallet Connection · Profile UI · Chat Interface   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐    ┌───────────────────────────┐    │
│  │    IDENTITY      │    │      INTELLIGENCE         │    │
│  │  People Chain    │    │  Phala Network TEE         │    │
│  │  Precompile      │    │  AI Vectorization          │    │
│  │  0x...901        │    │  Cosine Similarity Matching│    │
│  └────────┬─────────┘    └────────────┬──────────────┘    │
│           ▼                           ▼                   │
│  ┌──────────────────────────────────────────────────┐     │
│  │            LOGIC LAYER (Revive EVM / PolkaVM)    │     │
│  │  Token42Profile.sol     Token42Messaging.sol     │     │
│  │  • Soulbound Tokens     • rUSD Staking           │     │
│  │  • Identity Checks      • Signature Verification │     │
│  │  • CID Storage          • Slashing Oracle        │     │
│  └──────────────────────────────────────────────────┘     │
│                           ▼                               │
│  ┌──────────────────────────────────────────────────┐     │
│  │           STORAGE LAYER (Crust / IPFS)           │     │
│  │  Encrypted bios · Profile media · Metadata CIDs  │     │
│  └──────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

---

## 🔧 Development Workflow (Hardhat)

### Compile Contracts

```bash
npx hardhat compile
```

Compiles Solidity via `resolc` (Revive compiler) targeting PolkaVM bytecode.

### Run Tests

```bash
npx hardhat test
```

### Deploy to Paseo Testnet

```bash
# Set your private key (no 0x prefix)
npx hardhat vars set PRIVATE_KEY

# Deploy
npx hardhat ignition deploy ./ignition/modules/Token42Module.js --network passetHub
```

### Debug

```bash
npx hardhat clean                      # Clear build artifacts
rm -rf ignition/deployments/           # Reset deployment state
npx hardhat console --network passetHub
```

---

## 🌐 Network Configuration (Paseo Asset Hub)

| Setting | Value |
|---|---|
| **Chain ID** | `420420417` |
| **RPC URL** | `https://eth-rpc-testnet.polkadot.io` |
| **Explorer** | [blockscout-passet-hub.parity-testnet.parity.io](https://blockscout-passet-hub.parity-testnet.parity.io/) |
| **Faucet** | [faucet.polkadot.io](https://faucet.polkadot.io/?parachain=1111) |
| **Currency** | PAS |

### Hardhat Config (`hardhat.config.js`)

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");
const { vars } = require("hardhat/config");

module.exports = {
  solidity: "0.8.28",
  resolc: { version: "0.3.0", compilerSource: "npm" },
  networks: {
    hardhat: { polkavm: true },
    passetHub: {
      polkavm: true,
      url: "https://eth-rpc-testnet.polkadot.io",
      accounts: [vars.get("PRIVATE_KEY")],
    },
  },
};
```

---

## 📂 Project Structure

```
token42/
├── .devcontainer/               # DevContainer configuration
│   ├── devcontainer.json
│   ├── Dockerfile
│   └── scripts/                 # Setup & initialization scripts
├── contracts/                   # Hardhat contracts (Solidity ^0.8.28, no OZ)
│   ├── Token42Profile.sol       # Minimal soulbound profile
│   ├── Token42Messaging.sol     # Minimal staked messaging
│   └── MockRUSD.sol             # Test mock ERC-20
├── ignition/modules/            # Hardhat Ignition deployment scripts
│   └── Token42Module.js
├── test/                        # Hardhat tests
│   ├── Token42Profile.test.js
│   └── Token42Messaging.test.js
├── agent/                       # Phala TEE AI Agent
├── frontend/                    # React dApp
├── guides/                      # Documentation
│   ├── AGENTS.md                # AI agent instructions
│   └── KITDOT_HACKATHON_GUIDE.md  # ← This guide
├── hardhat.config.js            # Hardhat + PolkaVM configuration
└── README.md
```

---

## 📋 Smart Contracts Summary

### Token42Profile (Soulbound)

- **Minimal ERC-721** — no OpenZeppelin (stays under 100KB PolkaVM limit)
- **Identity Precompile** check at `0x...901` (Polkadot People Chain)
- **One profile per human** — `hasProfile` + verification gate
- **Non-transferable** — `transferFrom` always reverts

### Token42Messaging (Staked Messaging)

- **rUSD staking** — senders lock tokens to message
- **AI Agent signature** — ECDSA verification of match intent
- **Claim / slash** — recipients claim by replying; AI Agent slashes harassment
- **Inline ECDSA** recovery — no OpenZeppelin dependency

---

## ⚠️ PolkaVM Constraints

| Constraint | Limit | Workaround |
|---|---|---|
| Bytecode size | ~100KB | Use minimal custom implementations |
| OpenZeppelin | Too large | Write inline (see `contracts-hardhat/`) |
| Solidity version | `^0.8.28` | Required by `resolc` compiler |

---

## 🛡️ Security Patterns

```solidity
// Minimal Ownable
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}

// Minimal Reentrancy Guard
bool private locked;
modifier nonReentrant() {
    require(!locked, "Reentrant call");
    locked = true; _; locked = false;
}
```

- **Never commit private keys.** Use `npx hardhat vars set PRIVATE_KEY`.
- **Testnet only.** Paseo tokens have no real value.
- **Verify contracts** on the block explorer after deployment.

---

## 🔗 Resources

| Resource | Link |
|---|---|
| Kitdot CLI | [npmjs.com/package/kitdot](https://www.npmjs.com/package/kitdot) |
| Hardhat Polkadot Plugin | [@parity/hardhat-polkadot](https://www.npmjs.com/package/@parity/hardhat-polkadot) |
| Polkadot Smart Contracts Docs | [docs.polkadot.com](https://docs.polkadot.com/develop/smart-contracts/) |
| Paseo Faucet | [faucet.polkadot.io](https://faucet.polkadot.io/?parachain=1111) |
| Block Explorer | [blockscout-passet-hub](https://blockscout-passet-hub.parity-testnet.parity.io/) |
| DevContainer Repo | [paritytech/smart-contracts-devcontainer](https://github.com/paritytech/smart-contracts-devcontainer) |
| Hackathon Guide | [polkadot-developers/hackathon-guide](https://github.com/polkadot-developers/hackathon-guide) |

---

## ✅ Troubleshooting Checklist

When deployment fails:

- [ ] Used `kitdot init` or DevContainer for setup
- [ ] `hardhat.config.js` includes `polkavm: true` and `resolc` block
- [ ] Private key set via `npx hardhat vars set PRIVATE_KEY`
- [ ] Account has sufficient PAS tokens
- [ ] Contract compiles without errors
- [ ] Contract size under 100KB
- [ ] No OpenZeppelin dependencies causing size issues
- [ ] Clean deployment state: `rm -rf ignition/deployments/`
