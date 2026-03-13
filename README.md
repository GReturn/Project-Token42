<p align="center">
  <img src="frontend/public/token42.png" alt="Token42 Logo" width="200" />
  <h1 align="center">Token42</h1>
  <p align="center"><strong>Decentralized AI Dating Platform on Polkadot</strong></p>
  <p align="center">
    <em>Verifiable Identity · Private AI Matching · Staked Connections</em>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity" alt="Solidity" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Hardhat-PolkaVM-FFF100?logo=hardhat" alt="Hardhat" />
  <img src="https://img.shields.io/badge/Polkadot-Paseo_Testnet-E6007A?logo=polkadot&logoColor=white" alt="Polkadot" />
  <img src="https://img.shields.io/badge/Phala-TEE_Agents-CDFA50" alt="Phala" />
  <img src="https://img.shields.io/badge/DevContainer-Ready-blue?logo=docker" alt="DevContainer" />
</p>

---

## 📖 Overview

Token42 is a next-generation dating platform that solves the **"Trust Gap"** in online dating. By combining Polkadot's verifiable identity infrastructure with AI-powered matching inside secure enclaves, Token42 ensures that every user is a **real human**, every match is **privately computed**, and every interaction is **economically accountable**.

> The name represents the search for the ultimate connection in a verifiable, tokenized world.

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| 🪪 **Verifiable Identity** | Connect with real humans verified via Polkadot's People Chain identity infrastructure. |
| 🤖 **Private AI Matching** | Private personality analysis inside Phala Network's secure enclaves (TEE). |
| 💰 **Staked Messaging** | Anti-spam protocol using rUSD staking to ensure high-value connections. |
| 🏷️ **Soulbound Profiles** | Non-transferable digital identities on the Revive EVM (PolkaVM). |
| 🛡️ **AI Moderation Oracle** | Automated harassment detection with on-chain slashing penalties |

---

## 🏗️ Architecture

Token42 is built on a **four-layer decentralized stack**:

```
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND (React/Vite)                 │
│         Wallet Connection · Profile UI · Chat Interface     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────┐    ┌─────────────────────────────┐   │
│  │    IDENTITY       │    │      INTELLIGENCE           │   │
│  │  People Chain     │    │  Phala Network TEE          │   │
│  │  (DID / Precomp.) │    │  Llama-3-8B Vectorization   │   │
│  │  0x...901         │    │  Cosine Similarity Matching │   │
│  └────────┬──────────┘    │  Match Intent Signing       │   │
│           │               └─────────────┬───────────────┘   │
│           ▼                             ▼                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               LOGIC LAYER (Revive EVM)               │   │
│  │  Token42Profile.sol      Token42Messaging.sol        │   │
│  │  • Soulbound Tokens      • rUSD Staking              │   │
│  │  • Identity Checks       • Signature Verification    │   │
│  │  • CID Storage           • Slashing Oracle           │   │
│  └──────────────────────────────────────────────────────┘   │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            STORAGE LAYER (IPFS / Pinata)             │   │
│  │  Encrypted bios · Profile media · Metadata CIDs      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧰 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Smart Contracts** | Solidity 0.8.28, Minimal impls (no OZ), Hardhat | Profile SBTs, staked messaging, slashing |
| **Runtime** | Polkadot Asset Hub (Revive EVM / PolkaVM) | EVM-compatible execution on Polkadot |
| **Identity** | Paseo People Chain, Identity Precompile (`0x...901`) | On-chain human verification (DID) |
| **AI Engine** | Phala Network TEE, Llama-3-8B | Private personality vectorization & matching |
| **Storage** | IPFS (Pinata) | Decentralized media & metadata hosting |
| **Frontend** | React 18, TypeScript, Vite, ethers.js | Mobile-responsive dApp interface |
| **Wallets** | SubWallet, Talisman, MetaMask | Transaction signing & identity proofs |
| **Testing** | Hardhat (npx hardhat test) | Contract unit & integration tests |
| **Dev Env** | DevContainers, Kitdot CLI | Zero-config development environment |

---

## 📂 Project Structure

```
token42/
├── .devcontainer/               # DevContainer setup (Docker + VS Code)
│   ├── devcontainer.json
│   ├── Dockerfile
│   └── scripts/                 # Setup & initialization scripts
├── contracts/                   # Hardhat-compatible (Solidity ^0.8.28, no OZ)
│   ├── contracts/               # Source files
│   │   ├── Token42Profile.sol   # Minimal soulbound profile
│   │   ├── Token42Messaging.sol # Minimal staked messaging
│   │   ├── MockRUSD.sol         # Test mock ERC-20
│   │   └── MockIdentityPrecompile.sol
├── ignition/modules/            # Hardhat Ignition deployment
│   └── Token42Module.js
├── test/                        # Hardhat tests
│   ├── Token42Profile.test.js
│   └── Token42Messaging.test.js
├── agent/                       # Phala TEE AI Agent
│   └── src/index.ts             # Express server & AI logic
├── frontend/                    # React dApp (Vite)
├── guides/                      # Comprehensive Documentation
│   ├── AGENTS.md                # AI agent instructions
│   ├── AI_INTEGRATION_GUIDE.md  # Technical bridge between AI and contracts
│   ├── KITDOT_HACKATHON_GUIDE.md # Development guide
│   ├── LOCAL_INFERENCE.md       # Running Llama 3 locally via Ollama
│   ├── LOCAL_TESTING_GUIDE.md   # 2-User interaction walkthrough
│   └── UI_INTEGRATION_GUIDE.md  # Identity & Messaging UI requirements
├── hardhat.config.js            # Hardhat + PolkaVM config
├── .gitignore
└── README.md
```

---

## 🛠️ Onboarding & Installation

> **Prerequisites:** Node.js 22+ and npm, [Ollama](https://ollama.com/) (for local AI matching), or Docker for DevContainers.

### Option A: DevContainer (RECOMMENDED)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop) and the [VS Code Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Open this project in VS Code
3. Click **"Reopen in Container"** — all tools install automatically

### Option B: Manual Setup

```bash
git clone https://github.com/GReturn/Project-Token42.git
cd Project-Token42
```

#### 1. Smart Contracts
```bash
npm install
npx hardhat compile
npx hardhat test
```

#### 2. AI Agent (Local Matching)
Ensure Ollama is running and you have pulled the model: `ollama pull llama3`.
```bash
cd agent
npm install
# Configure .env with your AGENT_PRIVATE_KEY
npx tsx src/index.ts
```

#### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🚀 Deployment Status (Paseo Asset Hub)

The contracts are live on the **Paseo Asset Hub (Revive EVM)**:
- **Token42Profile**: `0xD7dD2d357A377beb0bbF89BfF0f0b36549e8476B`
- **Token42Messaging**: `0x5f9b5ccAa4B13e23E41E9d3F9018963bE76f1347`

---

## 📖 Related Documentation

For deeper technical dives, see the following guides:

- 🧠 **[AI Integration Guide](guides/AI_INTEGRATION_GUIDE.md)**: How the AI Agent signs match intents for the blockchain.
- 💻 **[Local Inference Setup](guides/LOCAL_INFERENCE.md)**: Setting up Ollama and Llama 3 for private local matching.
- 👥 **[Local Testing Guide](guides/LOCAL_TESTING_GUIDE.md)**: Stepper-by-step walkthrough of a 2-user interaction.
- 🎨 **[UI Integration Guide](guides/UI_INTEGRATION_GUIDE.md)**: Handling identity verification and messaging errors in React.
- 🛠️ **[Hackathon Guide](guides/KITDOT_HACKATHON_GUIDE.md)**: Core development workflow and architecture.

---

## ⚠️ Hackathon Prototype Caveats

> [!IMPORTANT]
> This version of Token42 is a **Hackathon Prototype**. To facilitate the demonstration, the following elements are currently simplified or mocked:

1.  **Mock Data**: The frontend initially populates some state with mock profile data to show the UI without waiting for IPFS/Contract indexing.
2.  **Identity Simulation**: The People Chain identity check is simulated in the UI; in production, this calls the `0x...901` precompile via a `staticcall`.
3.  **Storage**: Integration with Pinata (IPFS) is functional, but currently uses a public gateway for demonstration.
4.  **Slashing**: The moderation `/slash` endpoint is exposed for developers but not yet triggered by an automated on-chain oracle.

---

## 🔄 User Flow

```
Connect Wallet  ──►  Verify Identity  ──►  Mint SBT Profile  ──►  AI Matching  ──►  Stake & Chat
     │                    │                      │                     │                  │
  SubWallet /         People Chain           Token42Profile       Phala TEE Agent    Token42Messaging
  Talisman            Precompile 0x901       (Soulbound)         Cosine Similarity   rUSD Lock/Claim
```

---

## 🌍 SDG Alignment

| SDG | Impact |
|---|---|
| **SDG 5 — Gender Equality** | AI moderation + staking reduces harassment; economic penalties deter bad actors |
| **SDG 16 — Peace, Justice & Strong Institutions** | Sovereign decentralized identity; no central authority owns your data |

---

## 📜 License

MIT


