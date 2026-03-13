# Local Testing Guide: 2-User Interaction

This guide explains how to test the full Token42 flow (Identity -> Profile -> Matching -> Staking -> Claiming/Slashing) on your local machine using two different accounts.

## Prerequisites

1.  **Ollama**: Install and pull the model.
    ```bash
    ollama pull llama3
    ```
2.  **MetaMask / SubWallet**: Ensure you have two accounts with Paseo Asset Hub (Revive EVM) test tokens.
3.  **rUSD Tokens**: You can get mock rUSD by calling `faucet()` on the rUSD mock contract if deployed, or use the owner account to transfer some to your test accounts.

## Step 1: Start the AI Agent Server

The AI Agent now includes an Express server to handle matching and moderation locally.

1.  Open a terminal in the `agent` directory.
2.  Install dependencies: `npm install`
3.  **Setup Environment**: 
    Create a `.env` file in the `agent` directory:
    ```bash
    cp .env.example .env
    ```
    Then, edit the `.env` file and add your `AGENT_PRIVATE_KEY` (e.g., the Hardhat #0 key for local testing: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`).
4.  Run the agent:
    ```bash
    npx tsx src/index.ts
    ```
    The server should start on `http://localhost:3001`.

## Step 2: Launch the Frontend

1.  Open a terminal in the `frontend` directory.
2.  Run the dev server: `npm run dev`
3.  Open [http://localhost:5173](http://localhost:5173).

## Step 3: Simulate Two Users

To test interaction, you need two separate browser contexts:
- **User A**: Main Browser tab.
- **User B**: Incognito tab or a different browser (e.g., Firefox if you use Chrome).

### User A: Profile Setup
1.  Connect Wallet as **Account 1**.
2.  Enter a bio (e.g., "I love blockchain and hiking").
3.  Click **Mint Soulbound Profile**.
4.  Wait for the transaction to confirm.

### User B: Profile Setup
1.  Connect Wallet as **Account 2**.
2.  Enter a bio (e.g., "Avid traveler and DeFi enthusiast").
3.  Click **Mint Soulbound Profile**.

## Step 4: AI Matching & Staking

1.  Switch back to **User A**.
2.  Click **Find Matches**. The frontend will call your local AI Agent.
3.  User B should appear with a match score.
4.  Click **Stake & Message**. This will prompt Account 1 to stake 1 rUSD.

## Step 5: Claiming the Stake

1.  Switch to **User B**.
2.  The UI should show an incoming message from User A.
3.  Click **Reply & Claim Stake**. This will transfer the stake (minus protocol fee) to Account 2.

## Step 6: Testing AI Moderation (Slashing)

1.  If User A sends a harassing message, you can simulate a report.
2.  Click **Report & Slash** (Available in Dev mode).
3.  The local agent will receive the report, and the stake will be slashed (transferred to the treasury owner).

---

### Troubleshooting
- **Ollama Error**: Ensure Ollama is running (`ollama serve`).
- **Signature Error**: Ensure the Agent Server is running with the same private key that was configured as `aiAgent` in the `Token42Messaging` constructor.
- **Pending Tx**: Paseo testnet can sometimes be slow; check the Blockscout link if it hangs.
