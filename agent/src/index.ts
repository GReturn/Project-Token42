import { ethers } from 'ethers';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';

dotenv.config();

interface UserProfile {
    address: string;
    personalityBio?: string;
    personalityVector?: number[];
    cid: string;
}

/**
 * @title Token42 AI Agent
 * @dev Runs locally (or in TEE) to provide private personality matching.
 *      Uses Ollama for local embedding generation.
 */
export class Token42Agent {
    private agentWallet: ethers.Wallet;
    private ollamaUrl = 'http://localhost:11434/api/embeddings';

    constructor(privateKey: string) {
        this.agentWallet = new ethers.Wallet(privateKey);
        console.log(`Agent initialized with address: ${this.agentWallet.address}`);
    }

    public getAddress(): string {
        return this.agentWallet.address;
    }

    /**
     * @dev Generate embeddings using local Ollama instance (Llama 3).
     */
    public async generateEmbedding(text: string): Promise<number[]> {
        try {
            const response = await axios.post(this.ollamaUrl, {
                model: 'llama3',
                prompt: text
            });
            return response.data.embedding;
        } catch (error) {
            console.warn("Ollama connection failed, using mock embedding. Pull llama3 to fix!");
            return Array(4096).fill(0).map(() => Math.random());
        }
    }

    public calculateSimilarity(v1: number[], v2: number[]): number {
        if (!v1 || !v2 || v1.length !== v2.length) return 0;
        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;
        for (let i = 0; i < v1.length; i++) {
            dotProduct += v1[i] * v2[i];
            mag1 += v1[i] * v1[i];
            mag2 += v2[i] * v2[i];
        }
        return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
    }

    public async signMatch(userA: string, userB: string, score: number, nonce: number): Promise<string> {
        const scoreBps = Math.floor(score * 100);
        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'address', 'uint256', 'uint256'],
            [userA, userB, scoreBps, nonce]
        );
        return await this.agentWallet.signMessage(ethers.getBytes(messageHash));
    }

    public async fetchFromIPFS(cid: string): Promise<any> {
        const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
        try {
            const response = await axios.get(url, { timeout: 10000 });
            return response.data;
        } catch (error) {
            console.error(`Failed to fetch CID ${cid} from IPFS:`, error);
            throw error;
        }
    }

    public async handleMatchRequest(currentUser: UserProfile, potentialMatches: UserProfile[], nonce: number) {
        if (!currentUser.personalityBio && currentUser.cid) {
            const data = await this.fetchFromIPFS(currentUser.cid);
            currentUser.personalityBio = data.bio;
        }

        console.log(`Generating embedding for ${currentUser.address}...`);
        const userVector = await this.generateEmbedding(currentUser.personalityBio || "");

        console.log(`Analyzing ${potentialMatches.length} matches...`);
        const resultPromises = potentialMatches.map(async (match) => {
            if (!match.personalityBio && match.cid) {
                const data = await this.fetchFromIPFS(match.cid);
                match.personalityBio = data.bio;
            }
            const matchVector = await this.generateEmbedding(match.personalityBio || "");
            return {
                address: match.address,
                score: this.calculateSimilarity(userVector, matchVector)
            };
        });

        const results = await Promise.all(resultPromises);
        results.sort((a, b) => b.score - a.score);

        const topMatch = results[0];
        if (topMatch && topMatch.score > 0.8) {
            console.log(`Top match: ${topMatch.address} (${(topMatch.score * 100).toFixed(2)}%)`);
            const signature = await this.signMatch(currentUser.address, topMatch.address, topMatch.score, nonce);
            return {
                matchAddress: topMatch.address,
                score: Math.floor(topMatch.score * 100),
                signature: signature
            };
        }

        return null;
    }
}

// Start Server
const app = express();
app.use(cors());
app.use(express.json());

// For local testing, we use the environment variable
const DEV_KEY = process.env.AGENT_PRIVATE_KEY;

if (!DEV_KEY) {
    console.error("❌ ERROR: AGENT_PRIVATE_KEY is not defined in .env file");
    process.exit(1);
}

const agent = new Token42Agent(DEV_KEY);

app.post('/match', async (req, res) => {
    try {
        const { currentUser, potentialMatches, nonce } = req.body;
        const result = await agent.handleMatchRequest(currentUser, potentialMatches, nonce);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/slash', async (req, res) => {
    // This endpoint would normally be triggered by an AI moderation component 
    // that analyzes chat logs. For testing, we expose it to the developer.
    const { sender, recipient } = req.body;
    console.log(`Moderation Alert: Slashing ${sender} for reported harassment against ${recipient}`);
    // In a real TEE, the agent would call the contract directly. 
    // Here we just acknowledge the intent.
    res.json({ status: "Slashed", sender, recipient });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 Token42 AI Agent Server running on http://localhost:${PORT}`);
    console.log(`Agent Address: ${agent.getAddress()}`);
});
