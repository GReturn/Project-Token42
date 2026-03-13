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
│   ├── Token42Profile.sol       # Minimal soulbound profile
│   ├── Token42Messaging.sol     # Minimal staked messaging
│   └── MockRUSD.sol             # Test mock ERC-20
├── ignition/modules/            # Hardhat Ignition deployment
│   └── Token42Module.js
├── test/                        # Hardhat tests
│   ├── Token42Profile.test.js
│   └── Token42Messaging.test.js
├── agent/                       # Phala TEE AI Agent
│   └── src/index.ts
├── frontend/                    # React dApp
├── guides/
│   ├── AGENTS.md                # AI agent instructions
│   └── KITDOT_HACKATHON_GUIDE.md # Development guide
├── hardhat.config.js            # Hardhat + PolkaVM config
├── .gitignore
└── README.md
```

---

## 🛠️ Onboarding & Installation

> **Prerequisites:** Node.js 22+ and npm, or Docker for DevContainers.

### Option A: DevContainer (RECOMMENDED)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop) and the [VS Code Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Open this project in VS Code
3. Click **"Reopen in Container"** — all tools install automatically

### Option B: Kitdot CLI

```bash
npm install -g kitdot
kitdot init token42
cd token42
```

### Option C: Manual Setup

```bash
git clone https://github.com/GReturn/Project-Token42.git
cd Project-Token42
```

#### Hardhat (PolkaVM / Recommended)

```bash
npm install --save-dev @parity/hardhat-polkadot solc@0.8.28
npm install --force @nomicfoundation/hardhat-toolbox
npx hardhat compile
npx hardhat test
```

### 🚀 Deployment Status (Paseo Asset Hub)

The contracts are live on the **Paseo Asset Hub (Revive EVM)**:
- **Token42Profile**: `0xf7cA780f3ad9173108fCd90dF0c156E1715EFf46`
- **Token42Messaging**: `0x5f963C7599990c941217E1d0D317F601dC1794CE`

### Run the AI Agent (Local Demo)

The agent simulates the TEE environment and matching logic.
```bash
# Recommended: Run with tsx for seamless ESM support
npx tsx agent/src/index.ts
```

### Launch the Frontend

**Note:** If you are using a DevContainer and encounter port-forwarding issues (`code-tunnel.exe` errors), run the frontend directly on your **host machine (Windows)** terminal.

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚠️ Hackathon Prototype Caveats

> [!IMPORTANT]
> This version of Token42 is a **Hackathon Prototype**. To facilitate the demonstration, the following elements are currently simplified or mocked:

1.  **Mock Data**: The frontend initially populates some state with mock profile data to show the UI without waiting for IPFS/Contract indexing.
2.  **Identity Simulation**: The People Chain identity check is simulated in the UI; in production, this calls the `0x...901` precompile via a `staticcall`.
3.  **Storage**: Integration with Pinata (IPFS) is functional, but currently uses a public gateway for demonstration.
4.  **Hardcoded Addresses**: The AI Agent's public key and contract addresses are hardcoded in `App.tsx` and `index.ts`.

**FOR PRODUCTION:** These mocks should be replaced with the Phala SDK and real-time on-chain identity verification via the People Chain.

> 📖 See [guides/KITDOT_HACKATHON_GUIDE.md](guides/KITDOT_HACKATHON_GUIDE.md) for the full development workflow.

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

none yet


