import { ethers } from 'ethers';

// Phala Agent Kit & SDK simplified types for hackathon demo
interface UserProfile {
    address: string;
    personalityVector: number[];
    cid: string;
}

/**
 * @title Token42 AI Agent
 * @dev Runs inside a Phala TEE to provide private personality matching.
 */
export class Token42Agent {
    private agentWallet: ethers.Wallet;

    constructor(privateKey: string) {
        this.agentWallet = new ethers.Wallet(privateKey);
    }

    /**
     * @dev Simple Cosine Similarity implementation.
     * Happens entirely inside the TEE, ensuring privacy.
     */
    public calculateSimilarity(v1: number[], v2: number[]): number {
        if (v1.length !== v2.length) return 0;
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
    public async signMatch(userA: string, userB: string, score: number): Promise<string> {
        const messageHash = ethers.utils.solidityKeccak256(
            ['address', 'address', 'uint256'],
            [userA, userB, Math.floor(score * 100)]
        );
        return await this.agentWallet.signMessage(ethers.utils.arrayify(messageHash));
    }

    /**
     * @dev Handle matching request.
     */
    public async handleMatchRequest(currentUser: UserProfile, potentialMatches: UserProfile[]) {
        console.log(`Matching for ${currentUser.address}...`);

        const results = potentialMatches.map(match => ({
            address: match.address,
            score: this.calculateSimilarity(currentUser.personalityVector, match.personalityVector)
        }));

        // Sort by similarity
        results.sort((a, b) => b.score - a.score);

        // Top match logic
        const topMatch = results[0];
        console.log(`Top match: ${topMatch.address} with score ${topMatch.score}`);

        if (topMatch.score > 0.8) {
            const signature = await this.signMatch(currentUser.address, topMatch.address, topMatch.score);
            return {
                matchAddress: topMatch.address,
                score: topMatch.score,
                signature: signature
            };
        }

        return null;
    }
}

// Demo usage / Entry point
async function main() {
    // In TEE, the private key would be generated inside the enclave
    const agent = new Token42Agent(ethers.Wallet.createRandom().privateKey);

    const userA = {
        address: "0x123...",
        personalityVector: [0.1, 0.9, 0.3, 0.5],
        cid: "Qm..."
    };

    const userB = {
        address: "0x456...",
        personalityVector: [0.15, 0.85, 0.35, 0.45],
        cid: "Qm..."
    };

    const matchResult = await agent.handleMatchRequest(userA, [userB]);
    console.log("Match Result:", matchResult);
}

if (require.main === module) {
    main().catch(console.error);
}
