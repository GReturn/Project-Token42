# Token42: Decentralized AI Dating Platform

Token42 is a next-generation dating platform built on Polkadot, leveraging AI to bridge the "Trust Gap" through verifiable identity and staked interactions.

## 🚀 Key Features

- **Verifiable Identity**: Connect with real humans verified via Polkadot's People Chain.
- **AI Matching**: Private personality analysis inside Phala Network's secure enclaves (TEE).
- **Staked Messaging**: Anti-spam protocol using rUSD staking to ensure high-value connections.
- **Soulbound Profiles**: Non-transferable digital identities on the Revive EVM.

---

## 🛠️ Onboarding & Installation

This guide assumes you have **Node.js and npm** installed.

### 1. Clone & Setup

```bash
git clone https://github.com/GReturn/Project-Token42.git
cd token42
```

### 2. Install Smart Contract Tools (Foundry)

Since the contracts are built using Foundry, you'll need it to build and test. Run the following command to install it:

**Windows (PowerShell):**
```powershell
set-executionpolicy remotesigned -scope currentuser
iex (new-object net.webclient).downloadstring('https://foundry.paradigm.xyz/install.ps1')
foundryup
```

**macOS/Linux:**
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 3. Build & Test Contracts

```bash
cd contracts
npm install  # Installs OpenZeppelin dependencies
forge build
forge test
```

### 4. Run the AI Agent Local Demo

```bash
cd ../agent
npm install
npm run start # or node src/index.ts
```

### 5. Launch the Frontend

```bash
cd ../frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## 🏗️ Technical Architecture

- **Identity Layer**: Polkadot People Chain (DID).
- **Logic Layer**: Asset Hub / Revive EVM (Solidity SBTs).
- **Intelligence Layer**: Phala Network (TEE AI Agents).
- **Storage Layer**: Crust Network (IPFS/CIDs).

---

## 🌍 Sustainable Development Goals (SDG)

Token42 aligns with:
- **SDG 5 (Gender Equality)**: Protecting users from harassment via AI moderation and staking.
- **SDG 16 (Peace, Justice & Strong Institutions)**: Providing sovereign identity ownership.
