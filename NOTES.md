# 📝 Token42 — Notes for Blockchain Newcomers

> **Who is this for?** Anyone who's opening this project and thinking: *"What is a smart contract? What is a wallet? Why does any of this exist?"* This guide explains every concept with real-world analogies, then walks you through how every file in the project connects to form a complete application.

---

## Table of Contents

1. [The Big-Picture Analogy](#the-big-picture-analogy)
2. [Core Blockchain Concepts](#core-blockchain-concepts)
3. [The Token42 Idea in Plain English](#the-token42-idea-in-plain-english)
4. [Architecture — The Four Layers](#architecture--the-four-layers)
5. [File-by-File Walkthrough](#file-by-file-walkthrough)
6. [How Everything Connects — The User Journey](#how-everything-connects--the-user-journey)
7. [Key Technology Glossary](#key-technology-glossary)
8. [Common Questions](#common-questions)

---

## The Big-Picture Analogy

Imagine you're building a **dating app** — but instead of trusting a company like Tinder to run the servers, verify identities, and handle messages honestly, you're building one where:

- **The rules live in a public vending machine** (smart contracts) — anyone can read the rules, nobody can secretly change them.
- **Your ID card is issued by a government office** (Polkadot People Chain) — not by the dating app itself.
- **A sealed, tamper-proof matchmaker** (Phala TEE Agent) computes your compatibility score in a locked room — even the developers can't peek at the data.
- **Sending a message costs a small deposit** (staked messaging) — like putting a dollar in a jar to prove you're serious. If you're respectful, the other person gets the dollar. If you're abusive, the app confiscates it.

That's Token42 in a nutshell.

---

## Core Blockchain Concepts

### What is a Blockchain?

**Analogy: A Google Spreadsheet that nobody controls.**

A blockchain is a shared database (ledger) that thousands of computers keep a copy of. When someone writes a new row, every computer verifies it and adds it. Nobody can secretly delete or change rows because everyone else would notice.

- **Traditional app:** Your data lives on Tinder's servers. If Tinder goes down, your data is gone.
- **Blockchain app:** Your data lives on thousands of computers. No single point of failure.

### What is a Smart Contract?

**Analogy: A vending machine.**

A vending machine enforces a rule: *"If you insert $1 and press B4, you get chips."* It doesn't need a human clerk. It can't be bribed. The rule is literally its mechanism.

A **smart contract** is code deployed to a blockchain that enforces rules automatically. Once deployed, nobody — not even the creator — can secretly change the rules. In Token42:

- `Token42Profile.sol` is a vending machine that says: *"If you prove you're a real human, I'll mint you a permanent digital ID card."*
- `Token42Messaging.sol` is a vending machine that says: *"If you deposit 1 rUSD and have a valid AI-approved match, I'll let you send a message."*

### What is a Wallet?

**Analogy: Your house keys + your mailbox.**

A wallet has two parts:
- **Public address** (mailbox) — anyone can see it and send things to it. Example: `0x742d...4fd2`
- **Private key** (house keys) — only you have it. It proves you are the owner of that address.

When you "connect your wallet" to Token42, you're proving ownership of your identity without giving anyone your password.

### What is a Transaction?

**Analogy: A certified letter with a wax seal.**

When you do something on the blockchain (mint a profile, stake a message), you create a **transaction** — a signed instruction. Your wallet signs it with your private key (wax seal), proving it's really from you. Miners/validators then process it and add it to the "spreadsheet."

### What is an ERC-721 Token (NFT)?

**Analogy: A one-of-a-kind concert ticket.**

An ERC-721 token is a unique digital item tracked on the blockchain. In Token42, each user's profile is an ERC-721 token — specifically a **Soulbound Token (SBT)**, which is like a concert ticket that's *stapled to your arm*. You can't sell it, give it away, or transfer it. It's permanently yours. This prevents people from selling verified accounts.

### What is ERC-20?

**Analogy: Casino chips.**

An ERC-20 token is a fungible (interchangeable) currency on the blockchain. One chip equals another. In Token42, **rUSD** is the ERC-20 token used for staking. Think of it as the dollar bills you deposit when messaging someone.

### What are Gas Fees?

**Analogy: Postage stamps.**

Every transaction on a blockchain requires a small fee ("gas") paid to the network's validators — like putting a stamp on your certified letter. On the Paseo Testnet, gas is paid in **PAS** tokens, which are free test tokens (no real money).

---

## The Token42 Idea in Plain English

Token42 is a dating platform that tries to solve three problems traditional dating apps have:

| Problem | Traditional Apps | Token42's Solution |
|---|---|---|
| **Fake profiles** | Anyone can upload any photo | You must prove you're a real human through Polkadot's People Chain identity system |
| **Privacy** | The company can read all your data and sell it | AI matching happens inside a sealed secure enclave (TEE) — even developers can't see your data |
| **Spam & harassment** | Free to message means cheap to spam | You must lock up real money (rUSD) to send a message. Harassment gets your money confiscated |

---

## Architecture — The Four Layers

Think of Token42 like a **building with four floors:**

```
┌───────────────────────────────────────────────────────────┐
│  FLOOR 4: THE STOREFRONT (Frontend)                       │
│  What users see and click on — React app in a browser     │
├───────────────────────────────────────────────────────────┤
│  FLOOR 3: THE BACK OFFICES                                │
│  ┌────────────────────┐  ┌────────────────────────────┐   │
│  │ Government ID Desk │  │ Sealed Matchmaker's Room   │   │
│  │ (People Chain)     │  │ (Phala TEE AI Agent)       │   │
│  │ Verifies humans    │  │ Computes compatibility     │   │
│  └────────────────────┘  └────────────────────────────┘   │
├───────────────────────────────────────────────────────────┤
│  FLOOR 2: THE RULE BOOK (Smart Contracts on PolkaVM)      │
│  Token42Profile.sol    Token42Messaging.sol                │
│  "Issue ID cards"      "Handle deposits & messages"       │
├───────────────────────────────────────────────────────────┤
│  FLOOR 1: THE VAULT (IPFS / Crust Storage)                │
│  Stores photos, bios, and metadata in encrypted form      │
└───────────────────────────────────────────────────────────┘
```

The key insight: **Floors 1–3 are decentralized** — no single company runs them. Floor 4 (the frontend) is just a window into the system; anyone could build a different window.

---

## File-by-File Walkthrough

Below is every important file in the project, what it does, and why it exists. Files are grouped by the "floor" they belong to.

---

### 🏗️ The Foundation — Project Configuration

#### `package.json` (root)

```
Purpose: The project's "shopping list" of tools needed.
```

This tells Node.js which development tools to install:
- **`@nomicfoundation/hardhat-toolbox`** — A Swiss Army knife for smart contract development (testing, debugging, compiling).
- **`@parity/hardhat-polkadot`** — A plugin that teaches Hardhat how to compile for Polkadot's PolkaVM instead of regular Ethereum.
- **`solc`** — The Solidity compiler. Solidity is the programming language smart contracts are written in.

#### `hardhat.config.js`

```
Purpose: The "settings file" for the smart contract development tool.
```

**Analogy:** If Hardhat is a kitchen, this file is the recipe card pinned to the wall telling the chef what oven temperature (compiler version) and which restaurant location (network) to use.

Key settings:
- **`solidity: "0.8.28"`** — Use version 0.8.28 of the Solidity language.
- **`resolc`** — The special "Revive" compiler that translates Solidity into PolkaVM bytecode (Polkadot's virtual machine format) instead of regular Ethereum EVM bytecode.
- **`networks.hardhat`** — A local fake blockchain on your computer for testing. Like a sandbox.
- **`networks.passetHub`** — The real Paseo Testnet. Like a dress rehearsal on a real stage, but with fake money.

#### `.gitignore`

```
Purpose: Tells Git which files to NOT upload to GitHub.
```

Things like `node_modules/` (downloaded libraries, very large) and `cache/` (temporary compiler output) are excluded.

---

### 📜 Floor 2 — Smart Contracts (`contracts/contracts/`)

These are the "vending machines" — the automated rule enforcers.

#### `Token42Profile.sol` — The Digital ID Card Machine

**Analogy:** Imagine a kiosk at the airport that issues boarding passes. It checks your passport (identity verification), issues exactly one boarding pass per person (soulbound token), and that boarding pass is permanently attached to you (no transfers).

**What it does, step by step:**

1. **Interface `IIdentity`** (lines 8–10): Defines how to talk to Polkadot's Identity Precompile — a built-in service at address `0x...901` that can tell us: *"Is this wallet address owned by a verified human?"* Think of it as a phone number to dial the government ID office.

2. **Storage variables** (lines 25–33): The contract's "filing cabinet" that keeps track of:
   - `_owners` — Which token belongs to which person
   - `_balances` — How many tokens each person has (always 0 or 1)
   - `_tokenCIDs` — Each token's link to the person's profile info stored on IPFS
   - `_hasProfile` — Quick lookup: does this person already have a profile?

3. **`mintProfile(cid)`** (lines 85–105): The main function. When called:
   - ❌ *Already have a profile?* → Rejected. One per human.
   - ❌ *Not verified by the Identity Precompile?* → Rejected. Prove you're human first.
   - ✅ *All checks pass?* → Creates a new token, links it to your wallet, stores your IPFS CID (a pointer to your profile data stored off-chain).

4. **`transferFrom()`** (lines 118–120): Always reverts (fails). This is what makes it **soulbound** — you literally cannot transfer your profile to anyone else. The function exists only to comply with the ERC-721 standard's interface.

5. **`getProfileCID(user)`** (lines 110–113): Look up someone's profile data link. Like asking: *"What flight is this person on?"*

#### `Token42Messaging.sol` — The Staked Message System

**Analogy:** Imagine sending someone a letter, but you have to enclose a $1 bill in the envelope. If they write back, they get to keep the dollar. If a referee determines your letter was harassing, the referee confiscates your dollar.

**What it does, step by step:**

1. **`stakeForMessage(recipient, matchScore, signature)`** (lines 84–116): A user wants to message someone. Here's the process:
   - The AI Agent (our sealed matchmaker) has already computed a compatibility score and **signed** it with its private key.
   - The contract **verifies** that signature — proving the AI Agent really did approve this match and the score wasn't fabricated.
   - It checks the match score is ≥ 80% (you can only message high-compatibility matches).
   - It **pulls 1 rUSD** from the sender's wallet into the contract (like taking the dollar bill).
   - It records the match as "active."

2. **`claimStake(sender)`** (lines 121–132): The recipient replies. The contract releases the 1 rUSD to them. Like opening the envelope and pocketing the dollar.

3. **`slashStake(sender, recipient)`** (lines 138–150): The AI Agent detected harassment. Only the AI Agent can call this. The staked rUSD goes to the platform owner instead. The harasser loses their deposit.

4. **`_recover(hash, sig)`** (lines 154–174): Low-level cryptography function that verifies a digital signature. This is the "handwriting analysis" that proves the AI Agent really signed the match approval. It's normally provided by a library (OpenZeppelin), but Token42 implements it from scratch to keep the contract small enough for PolkaVM's 100KB limit.

#### `MockRUSD.sol` — Fake Money for Testing

**Analogy:** Play money in a board game.

This is a simple ERC-20 (fungible token) contract that exists **only for testing**. It creates 1,000 fake rUSD tokens so you can test the messaging contract without needing real tokens. The functions (`transfer`, `approve`, `transferFrom`) work exactly like sending, authorizing, and withdrawing money from a bank account.

In production, this would be replaced by the actual rUSD stablecoin on Polkadot.

---

### 🧪 Tests (`test/`)

**Analogy:** Before opening the vending machine to the public, you test it — insert coins, press every button, try to break it.

#### `Token42Profile.test.js`

Tests the profile contract:
- ✅ Does the deployer become the owner?
- ✅ Are the name and symbol correct (`Token42 Profile`, `T42P`)?
- ✅ Does transferring always fail? (soulbound check)
- ✅ Does a new user start with no profile?

#### `Token42Messaging.test.js`

Tests the messaging contract with a more complex setup:
- Deploys a MockRUSD and the messaging contract
- Funds a test "sender" with 100 rUSD
- ✅ Can a sender stake with a valid AI Agent signature?
- ✅ Does it reject match scores below 80?
- ✅ Can the recipient claim the staked funds?
- ✅ Can the AI Agent slash a sender's stake?
- ✅ Does it reject slashing from non-AI-Agent addresses?

The `createSignature()` helper function in the test simulates what the AI Agent does: it signs a message hash using the `aiAgent` signer — proving to the contract that the match was real.

---

### 🚀 Deployment (`ignition/modules/`)

#### `Token42Module.js` — The Deployment Script

**Analogy:** The instruction manual for installing the vending machines in the building.

Hardhat Ignition is a deployment framework. This file tells Hardhat:

1. **Deploy `Token42Profile`** — no constructor arguments needed.
2. **Deploy `Token42Messaging`** — needs two addresses:
   - `rUSD` — address of the rUSD token contract (defaults to zero address, configured per-network).
   - `aiAgent` — address of the AI Agent's wallet (also configured per-network).
3. **Return both** deployed contract references for further use.

---

### 🤖 Floor 3 — The AI Agent (`agent/`)

#### `agent/src/index.ts` — The Sealed Matchmaker

**Analogy:** A matchmaker locked in a soundproof, camera-free room. You slide personality questionnaires under the door. The matchmaker reads them, computes compatibility, writes a signed recommendation, and slides it back out. Nobody — not even the building's owner — can see what happens inside.

This is the **Phala TEE Agent**. TEE stands for **Trusted Execution Environment** — a hardware-level secure enclave where code runs in isolation.

**Key class: `Token42Agent`**

1. **`calculateSimilarity(v1, v2)`** (lines 25–36): Computes **cosine similarity** between two personality vectors. Think of personality as a point in space — this measures how close two points are in direction. Score of 1.0 = identical personality direction, 0 = completely different.

   *Example:* If Alice's personality vector is `[0.1, 0.9, 0.3, 0.5]` (introvert, empathetic, creative, adventurous) and Bob's is `[0.15, 0.85, 0.35, 0.45]` (nearly the same), the score will be very high (~0.99).

2. **`signMatch(userA, userB, score)`** (lines 41–47): Takes the match result and **cryptographically signs** it with the Agent's private key. This signature is what the smart contract verifies in `stakeForMessage()`. It's the Agent's stamp of approval saying: *"I, the sealed matchmaker, certify that these two users have X% compatibility."*

3. **`handleMatchRequest(currentUser, potentialMatches)`** (lines 52–77): The main workflow:
   - Calculates similarity between the current user and all potential matches.
   - Sorts by score (best first).
   - If the top match scores > 80%, signs and returns the match.
   - Otherwise, returns `null` (no good match found).

4. **`main()`** (lines 81–103): A demo entry point with fake data to show how the agent works.

**Dependencies:**
- **`@phala/sdk`** — SDK for deploying code into Phala Network's TEE.
- **`ethers`** — JavaScript library for interacting with Ethereum-compatible blockchains and doing cryptographic operations.
- **`@polkadot/api`** — SDK for interacting with Polkadot's native chain.

---

### 🖥️ Floor 4 — The Frontend (`frontend/`)

#### `frontend/src/App.tsx` — The User Interface

**Analogy:** The touchscreen on the vending machine. It doesn't enforce any rules itself — it just translates button presses into instructions for the vending machine.

The app has **four screens**, one for each step of the user journey:

1. **`connect` screen** — "Connect & Verify" button. Asks the browser for wallet access via MetaMask/SubWallet. Like swiping your keycard at the building entrance.

2. **`profile` screen** — Shows the verified address and a "Mint Soulbound Profile" button. The user writes a bio and creates their on-chain identity.

3. **`matching` screen** — "Find Matches" button. Would connect to the Phala TEE Agent. Currently shows mock data. Displays match cards with compatibility scores and a "Stake & Message" button.

4. **`chat` screen** — After staking, the chat interface appears. Shows a warning that harassment leads to slashing.

#### `frontend/src/App.css` — Styling

Uses CSS custom properties (variables) for a dark-theme dating app look:
- `--primary: #FF3366` — Rose pink, used for primary buttons
- `--bg: #0A0A0A` — Near-black background
- `--accent: #00FFCC` — Cyan-green, used for match scores and verification badges

---

### 🐳 DevContainer (`.devcontainer/`)

**Analogy:** A pre-configured workshop shipped in a shipping container. Instead of spending hours installing tools manually, you just open the container and everything is ready.

#### `devcontainer.json`

Tells VS Code:
- Build from the `Dockerfile`
- Mount the project into `/project` inside the container
- After starting, automatically run setup scripts (install keypair, configure Hardhat)
- Install useful VS Code extensions (Solidity, Rust, Prettier)

#### `Dockerfile`

Builds a Linux container with Node.js 22 and all the tools pre-installed (Foundry, `subkey`, Solidity compiler). This means every developer gets an identical environment regardless of their operating system.

---

### 📚 Guides (`guides/`)

#### `AGENTS.md`

Instructions for AI coding assistants (like Copilot) on how to work with this project — file structure, coding conventions, deployment steps.

#### `KITDOT_HACKATHON_GUIDE.md`

A developer guide covering:
- How to set up the project (3 different methods)
- Architecture overview
- Compilation, testing, and deployment commands
- Network configuration for Paseo Testnet
- PolkaVM constraints (100KB bytecode limit, no OpenZeppelin)
- Security patterns and troubleshooting

---

## How Everything Connects — The User Journey

Here's the complete flow of what happens when someone uses Token42, and which file handles each step:

```
 USER'S JOURNEY                     WHAT HAPPENS BEHIND THE SCENES
 ─────────────                      ───────────────────────────────

 1. Open the app                    → App.tsx loads in the browser
       │
 2. Click "Connect Wallet"          → App.tsx calls MetaMask/SubWallet
       │                              Browser pop-up asks for permission
       │                              User approves → wallet address returned
       │
 3. Identity Verification           → App.tsx talks to Polkadot People Chain
       │                              The Identity Precompile at 0x...901
       │                              confirms: "Yes, this is a verified human"
       │
 4. Click "Mint Soulbound Profile"  → App.tsx calls Token42Profile.sol's
       │                              mintProfile(cid) function
       │                              The contract checks identity, mints
       │                              a non-transferable ERC-721 token
       │                              Profile data (bio, photos) stored on IPFS
       │
 5. Click "Find Matches"            → App.tsx sends personality data to
       │                              agent/src/index.ts (Phala TEE Agent)
       │                              Agent runs calculateSimilarity()
       │                              inside the secure enclave
       │                              Returns top matches + signed approvals
       │
 6. Click "Stake & Message"         → App.tsx calls Token42Messaging.sol's
       │                              stakeForMessage(recipient, score, sig)
       │                              Contract verifies AI Agent's signature
       │                              Contract pulls 1 rUSD from sender
       │                              Match recorded as "active"
       │
 7. Recipient replies               → Recipient calls claimStake(sender)
       │                              Smart contract releases 1 rUSD to them
       │
 8. [If harassment detected]        → AI Agent calls slashStake()
                                      Sender's 1 rUSD goes to platform owner
                                      Sender penalized
```

### The Signature Chain of Trust

The entire system relies on **cryptographic signatures** — digital stamps that prove *who* approved *what*:

```
 Polkadot People Chain               Phala TEE Agent
 ✍️ Signs: "This wallet              ✍️ Signs: "These two users
  is a real human"                     have 92% compatibility"
        │                                     │
        ▼                                     ▼
 Token42Profile.sol                  Token42Messaging.sol
 Checks the signature               Checks the signature
 → Mints soulbound profile          → Allows staked messaging
```

Nobody trusts anybody's *word*. Every claim is backed by a verifiable cryptographic proof.

---

## Key Technology Glossary

| Term | Simple Explanation |
|---|---|
| **Polkadot** | A network of blockchains that can talk to each other. Token42 lives on its "Asset Hub" |
| **Paseo Testnet** | Polkadot's practice network with fake money. Like a flight simulator |
| **PolkaVM** | Polkadot's virtual machine that runs smart contracts. Like the CPU inside the vending machine |
| **Revive EVM** | A compatibility layer that lets Solidity (Ethereum's language) run on PolkaVM |
| **resolc** | The compiler that translates Solidity → PolkaVM bytecode |
| **Hardhat** | A developer toolkit for building, testing, and deploying smart contracts |
| **Hardhat Ignition** | Hardhat's deployment framework. Manages deploying contracts to networks |
| **Solidity** | The programming language for writing smart contracts (`.sol` files) |
| **Phala Network** | A blockchain specialized in privacy. Runs code in TEE (secure enclaves) |
| **TEE** | Trusted Execution Environment — hardware-sealed rooms where code runs privately |
| **IPFS / Crust** | Decentralized file storage. Like Google Drive but nobody owns the servers |
| **CID** | Content Identifier — IPFS's way of naming files by their content's fingerprint |
| **Soulbound Token (SBT)** | An NFT that cannot be transferred. Permanently bound to one wallet |
| **rUSD** | A stablecoin (value pegged to $1 USD) used for staking in Token42 |
| **ECDSA** | A cryptographic algorithm for creating and verifying digital signatures |
| **EIP-191** | A standard for how Ethereum-compatible wallets sign messages |
| **ethers.js** | JavaScript library for talking to Ethereum-compatible blockchains |
| **Gas** | The fee paid to the network for processing your transaction |
| **SubWallet / Talisman** | Browser extension wallets for Polkadot (like MetaMask for Ethereum) |

---

## Common Questions

### "Why not just use a normal database?"

A normal database has a single owner (a company). That company can:
- Read, sell, or leak your data
- Ban you without explanation
- Shut down, taking your account with it
- Artificially boost or hide profiles

With smart contracts, the **rules are public and unchangeable**. No company controls your profile. Your identity is *yours*.

### "Why PolkaVM instead of regular Ethereum?"

Polkadot offers:
- **Cheaper transactions** than Ethereum mainnet
- **Built-in identity verification** (People Chain) — Ethereum doesn't have this natively
- **Cross-chain communication** — Token42 could interact with other Polkadot apps
- **The Revive EVM** lets developers use Solidity (widely known) while getting Polkadot benefits

### "Why no OpenZeppelin?"

[OpenZeppelin](https://openzeppelin.com/) is a popular library of reusable, battle-tested smart contract code. Token42 doesn't use it because PolkaVM has a **100KB bytecode limit**. OpenZeppelin's contracts are feature-rich but large. Token42 writes minimal, hand-crafted implementations to stay under the limit.

### "Why does the AI Agent need to sign matches?"

Without the AI Agent's signature, anyone could call `stakeForMessage()` and claim a fake 100% match score. The signature proves that the **sealed, trusted AI actually computed that score** — not the user themselves. The smart contract verifies this signature on-chain before allowing the message.

### "What happens to my staked rUSD?"

Three possible outcomes:
1. **Recipient replies** → They claim your 1 rUSD (you spent $1 to start a genuine conversation).
2. **Harassment detected** → AI Agent slashes your stake (you lose $1 as a penalty).
3. **No reply** → Stake remains locked in the contract (currently no timeout/refund mechanism).

### "Is this real money?"

**On the Paseo Testnet: No.** PAS tokens and rUSD are completely free test tokens. This is a development/hackathon project. The entire testnet is like a sandbox — experiment freely.

---

> 💡 **Still confused about something?** The best way to learn is to run `npx hardhat test` and read what happens. Each test is a mini-story: *"Given this setup, when I do this, then this should happen."* Tests are the executable documentation of the project.
