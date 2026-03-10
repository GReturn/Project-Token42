<p align="center">
  <h1 align="center">💎 Token42</h1>
  <p align="center"><strong>Decentralized AI Dating Platform on Polkadot</strong></p>
  <p align="center">
    <em>Verifiable Identity · Private AI Matching · Staked Connections</em>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity" alt="Solidity" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Foundry-Latest-yellow" alt="Foundry" />
  <img src="https://img.shields.io/badge/Polkadot-Paseo_Testnet-E6007A?logo=polkadot&logoColor=white" alt="Polkadot" />
  <img src="https://img.shields.io/badge/Phala-TEE_Agents-CDFA50" alt="Phala" />
</p>

---

## 📖 Overview

Token42 is a next-generation dating platform that solves the **"Trust Gap"** in online dating. By combining Polkadot's verifiable identity infrastructure with AI-powered matching inside secure enclaves, Token42 ensures that every user is a **real human**, every match is **privately computed**, and every interaction is **economically accountable**.

> The name represents the search for the ultimate connection in a verifiable, tokenized world.

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| 🪪 **Verifiable Identity** | Proof-of-Humanity via Polkadot People Chain Identity Precompile. (to remove: Connect with real humans verified via Polkadot's People Chain.) |
| 🤖 **Private AI Matching** | Personality vectors analyzed inside Phala TEE — even developers can't see your data. (to remvoe: Private personality analysis inside Phala Network's secure enclaves (TEE).) |
| 💰 **Staked Messaging** | Senders lock rUSD to message; recipients claim it by replying — making spam unprofitable. (to remove: Anti-spam protocol using rUSD staking to ensure high-value connections.) |
| 🏷️ **Soulbound Profiles** | Non-transferable ERC-721 tokens ensure one real identity per person. (to remove: Non-transferable digital identities on the Revive EVM.) |
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
│  │            STORAGE LAYER (Crust / IPFS)              │   │
│  │  Encrypted bios · Profile media · Metadata CIDs      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧰 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Smart Contracts** | Solidity 0.8.20, OpenZeppelin, Foundry | Profile SBTs, staked messaging, slashing |
| **Runtime** | Polkadot Asset Hub (Revive EVM / PolkaVM) | EVM-compatible execution on Polkadot |
| **Identity** | Paseo People Chain, Identity Precompile (`0x...901`) | On-chain human verification (DID) |
| **AI Engine** | Phala Network TEE, Llama-3-8B | Private personality vectorization & matching |
| **Storage** | Crust Network / IPFS | Decentralized media & metadata hosting |
| **Frontend** | React 18, TypeScript, Vite, ethers.js | Mobile-responsive dApp interface |
| **Wallets** | SubWallet, Talisman, MetaMask | Transaction signing & identity proofs |
| **Testing** | Foundry (forge test), vm.etch mocking | Contract unit & integration tests |

---

## 📂 Project Structure

```
token42/
├── contracts/               # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── Token42Profile.sol      # Soulbound profile tokens
│   │   └── Token42Messaging.sol    # Staked messaging & slashing
│   ├── test/
│   │   ├── Token42Profile.t.sol    # Profile contract tests
│   │   └── Token42Messaging.t.sol  # Messaging contract tests
│   ├── remappings.txt
│   └── foundry.toml
├── agent/                   # Phala TEE AI Agent
│   └── src/
│       └── index.ts                # Matching engine & signing
├── frontend/                # React dApp
│   └── src/
│       ├── App.tsx                 # Main application component
│       └── App.css                 # Styling
├── .gitignore
└── README.md
```

---

## 🛠️ Onboarding & Installation

> **Prerequisites:** Node.js and npm installed.

### 1. Clone the Repository

```bash
git clone https://github.com/GReturn/Project-Token42.git
cd Project-Token42
```

### 2. Install Foundry (Smart Contract Toolchain)

Since the contracts are built using Foundry, you'll need it to build and test. Run the following command to install it:

**Windows (PowerShell):**
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
iex (New-Object Net.WebClient).DownloadString('https://foundry.paradigm.xyz/install.ps1')
foundryup
```

**macOS / Linux:**
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 3. Build & Test Contracts

```bash
cd contracts
npm install        # Installs OpenZeppelin
forge build        # Compiles contracts
forge test         # Runs all tests
```

### 4. Run the AI Agent (Local Demo)

```bash
cd ../agent
npm install
npx ts-node src/index.ts
```

### 5. Launch the Frontend

```bash
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

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
