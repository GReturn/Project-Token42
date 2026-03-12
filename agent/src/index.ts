import { ethers } from 'ethers';
import axios from 'axios';

interface UserProfile {
    address: string;
    personalityBio: string;
    personalityVector?: number[]; // Added by the agent
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
            console.error("Embedding generation failed. Is Ollama running?");
            // Fallback mock vector if Ollama is not available during dev
            return Array(4096).fill(0).map(() => Math.random());
        }
    }

    /**
     * @dev Simple Cosine Similarity implementation.
     */
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

    /**
     * @dev Sign a "Match Intent" payload that the Smart Contract can verify.
     */
    public async signMatch(userA: string, userB: string, score: number, nonce: number): Promise<string> {
        // Score is expressed in basis points (0-10000) for the contract
        const scoreBps = Math.floor(score * 100);
        
        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'address', 'uint256', 'uint256'],
            [userA, userB, scoreBps, nonce]
        );
        
        // EIP-191 signature (prefixed)
        return await this.agentWallet.signMessage(ethers.getBytes(messageHash));
    }

    /**
     * @dev Handle matching request using local inference.
     */
    public async handleMatchRequest(currentUser: UserProfile, potentialMatches: UserProfile[], nonce: number) {
        console.log(`Generating embedding for ${currentUser.address}...`);
        const userVector = await this.generateEmbedding(currentUser.personalityBio);

        console.log(`Analyzing matches...`);
        const resultPromises = potentialMatches.map(async (match) => {
            const matchVector = await this.generateEmbedding(match.personalityBio);
            return {
                address: match.address,
                score: this.calculateSimilarity(userVector, matchVector)
            };
        });

        const results = await Promise.all(resultPromises);

        // Sort by similarity
        results.sort((a, b) => b.score - a.score);

        // Top match logic
        const topMatch = results[0];
        console.log(`Top match: ${topMatch.address} with score ${(topMatch.score * 100).toFixed(2)}%`);

        // Min score for signing (0.8 = 80%)
        if (topMatch.score > 0.8) {
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

// Demo usage / Entry point
async function main() {
    // In production TEE, this key would be inside the enclave.
    // For demo, we use a fixed "admin" key or random one.
    const agent = new Token42Agent(ethers.Wallet.createRandom().privateKey);

    const userA: UserProfile = {
        address: "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf",
        personalityBio: "I love hiking, decentralized finance, and drinking specialty coffee in Tokyo.",
        cid: "QmX123"
    };

    const userB: UserProfile = {
        address: "0x375ac89e80AE2169EC049B5780831A58bab5f7e3",
        personalityBio: "Avid mountaineer and blockchain developer. I spend my weekends exploring the Alps.",
        cid: "QmY456"
    };

    console.log("Starting local AI match analysis...");
    const matchResult = await agent.handleMatchRequest(userA, [userB], 0);
    console.log("Match Result:", matchResult);
}

if (require.main === module) {
    main().catch(console.error);
}
