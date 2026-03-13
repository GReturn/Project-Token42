# Token42 AI Integration Guide

This guide details how to bridge the **Local AI Matching Agent** with the **Smart Contracts** and the **React Frontend**.

## 1. Technical Verification (The "Handshake")

The most critical part of the integration is the ECDSA signature. The AI Agent signs a "Match Intent" which the contract verifies.

### Data Format (EIP-191)
Both the Agent and the Contract use the following structure for signing:
`keccak256(abi.encodePacked(sender, recipient, matchScore, nonce))`

- **Sender**: Use the wallet address of the user initiating the match.
- **Recipient**: The wallet address of the potential match.
- **Match Score**: A `uint256` from 0-100 (e.g., `92` for 92%).
- **Nonce**: Current nonce of the sender (tracked in `Token42Messaging.sol`).

---

## 2. Integration Steps (Local Mode)

### Step A: Start the AI Agent
1.  Ensure [Ollama](https://ollama.com/) is running.
2.  Pull the model: `ollama pull llama3`.
3.  Run the agent: `npx tsx agent/src/index.ts`.
    *   *Note: In production, this would be wrapped in an Express server listening on port 3001.*

### Step B: Frontend Request
Your frontend should capture the user's bio and send it to the agent. The agent expects the current user's profile, a list of potential matches, and the current on-chain nonce:

```typescript
// Example call from React App.tsx to Local Agent
const response = await fetch('http://localhost:3001/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        currentUser: { address, cid: userCID },
        potentialMatches, // Array of { address, cid, personalityBio }
        nonce: Number(nonce)
    })
});
const { matchAddress, score, signature } = await response.json();
```

### Step C: Execute Staked Message
Once you have the signature, call the smart contract on Paseo Asset Hub:

```typescript
const tx = await messagingContract.stakeForMessage(
    matchAddress, 
    score, 
    signature
);
await tx.wait();
```

---

## 3. Switching to Phala TEE

To move from **Local** to **Production (Phala)**, follow these steps:

| Feature | Local Inference (Current) | Phala TEE Integration |
|---|---|---|
| **Embedding Engine** | Ollama (Local API) | Phala TEE Node Inference |
| **API Endpoint** | `http://localhost:11434` | `http://llm-api.phala` (Internal TEE) |
| **Private Key** | From `.env` | Derived inside the Enclave (Confidential) |
| **Deployment** | Node.js process | Docker Image via `dstack` |

### To Switch:
1.  **Refactor**: Change the `axios.post` in `agent/src/index.ts` to use the Phala Internal Fetch API.
2.  **Deploy**: Push your agent as a Docker image to Phala Cloud.
3.  **Bootstrap**: Use the newly generated Phala public key as an Admin in the `Token42Messaging` contract (`addAdmin`).

---

## 🛡️ Security Note
The AI Agent's signature ensures that **Staked Connections** only happen if the AI verifies a high compatibility score. This prevents bots from mass-staking messages to random users.
