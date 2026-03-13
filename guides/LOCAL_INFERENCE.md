# Local AI Inference Setup (RTX 4060)

This guide explains how to run the Token42 AI matching engine locally using your GPU for maximum privacy and performance.

## Prerequisites

1.  **Ollama**: Install from [ollama.com](https://ollama.com/).
2.  **Llama 3**: Pull the model by running:
    ```bash
    ollama pull llama3
    ```

## Running the Agent

The AI Agent generates embeddings and signs match intents.

1.  Navigate to the agent directory:
    ```bash
    cd agent
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the agent (simulated demo):
    ```bash
    npx tsx src/index.ts
    ```

## How it Works

1.  **Embedding Generation**: The agent sends your personality bio to Ollama's local API (`http://localhost:11434/api/embeddings`).
2.  **Vector Comparison**: Cosine similarity is calculated locally on your CPU/GPU.
3.  **On-Chain Signing**: The agent signs the match result with its private key.
4.  **Verification**: The `Token42Messaging` smart contract verifies this signature on the Paseo Asset Hub before allowing a staked message.

## Frontend Integration Guide

Since your agent runs locally, you can connect your React frontend to it by wrapping the agent in a simple API server (e.g., Express) or calling it directly if using a tool like `tsx`.

### 1. API Endpoint (Agent Side)

The agent in `agent/src/index.ts` already includes an Express server. It exposes a `POST /match` endpoint that handles personality vectorization, similarity calculation, and message signing.

```typescript
// agent/src/index.ts (Actual implementation)
app.post('/match', async (req, res) => {
    try {
        const { currentUser, potentialMatches, nonce } = req.body;
        const result = await agent.handleMatchRequest(currentUser, potentialMatches, nonce);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
```

### 2. React Integration (Frontend Side)

In your `App.tsx`, call the local agent to get the signed payload before staking. Ensure you pass the `nonce` from the `Token42Messaging` contract.

```typescript
const findMatches = async () => {
    const nonce = await messagingContract.nonces(address);
    const response = await fetch('http://localhost:3001/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            currentUser: { address, cid: userCID },
            potentialMatches,
            nonce: Number(nonce)
        })
    });
    const data = await response.json();
    setMatches([data]);
};

const stakeAndMessage = async (match) => {
    // match.matchAddress, match.score, match.signature
    const tx = await messagingContract.stakeForMessage(
        match.matchAddress, 
        match.score, 
        match.signature
    );
    await tx.wait();
};
```
