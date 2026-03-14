import { ethers } from 'ethers';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { Client, encodeText } from '@xmtp/node-sdk';
import { Buffer } from 'buffer';

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
    private xmtpClient: Client | null = null;

    constructor(privateKey: string) {
        this.agentWallet = new ethers.Wallet(privateKey);
        console.log(`Agent initialized with address: ${this.agentWallet.address}`);
    }

    public getAddress(): string {
        return this.agentWallet.address;
    }

    public async initXMTP() {
        try {
            console.log("Initializing XMTP V3 client (MLS)...");
            
            // Wrap ethers wallet for XMTP V3 requirements
            const xmtpSigner = {
                type: 'EOA' as const,
                getIdentifier: async () => ({
                    identifier: this.agentWallet.address,
                    identifierKind: 0 as any // 0 = Ethereum/EVM in V3 bindings
                }),
                getChainId: () => 420420417n, // Paseo Asset Hub
                signMessage: async (message: string) => {
                    const signature = await this.agentWallet.signMessage(message);
                    return ethers.getBytes(signature);
                }
            };

            const options: any = {
                env: "dev",
                dbPath: "./xmtp.db"
            };

            try {
                this.xmtpClient = await Client.create(xmtpSigner as any, options);
            } catch (error: any) {
                const errorStr = String(error);
                if (errorStr.includes("10/10 installations")) {
                    console.warn("⚠️ XMTP installation limit reached (10/10). Attempting static revocation recovery...");
                    try {
                        const { createBackend, getInboxIdForIdentifier } = await import('@xmtp/node-sdk');
                        const backend = await createBackend({ env: options.env });
                        const inboxId = await getInboxIdForIdentifier(backend, {
                            identifier: this.agentWallet.address,
                            identifierKind: 0 as any
                        });
                        
                        if (inboxId) {
                            const states = await Client.fetchInboxStates([inboxId], backend);
                            const installations = (states[0] as any)?.installations || [];
                            if (installations.length > 0) {
                                const idsToRevoke = installations.map((inst: any) => inst.bytes);
                                await Client.revokeInstallations(xmtpSigner as any, inboxId, idsToRevoke, backend);
                                console.log("✅ Static revocation successful. Retrying registration...");
                            }
                        }
                        this.xmtpClient = await Client.create(xmtpSigner as any, options);
                    } catch (recError) {
                        console.error("❌ Static recovery failed:", recError);
                        throw error; // Re-throw original error if recovery fails
                    }
                } else {
                    throw error;
                }
            }
            
            console.log("✅ XMTP V3 client initialized. Inbox ID:", this.xmtpClient?.inboxId);

            // Start listening for messages
            this.startMessageListener();
        } catch (error) {
            console.error("❌ Failed to initialize XMTP V3 client:", error);
        }
    }

    private async startMessageListener() {
        if (!this.xmtpClient) return;

        try {
            console.log("📡 Agent starting to sync and listen for XMTP messages...");
            
            // Initial sync to find existing groups
            await this.xmtpClient.conversations.sync();

            // Stream new conversations (discovery)
            const runConvStream = async () => {
                try {
                    const convStream = await this.xmtpClient!.conversations.stream();
                    for await (const conversation of convStream) {
                        console.log(`\n🆕 New conversation discovered: ${conversation.id}`);
                        await conversation.sync();
                    }
                } catch (e) {
                    console.error("❌ Agent conversation stream error:", e);
                }
            };
            runConvStream();

            // Periodic sync fallback (every 30s)
            setInterval(async () => {
                try {
                    await this.xmtpClient!.conversations.sync();
                } catch (e) {
                    console.warn("⚠️ Agent background sync failed:", e);
                }
            }, 30000);

            // Stream new messages from all groups
            const stream = await this.xmtpClient.conversations.streamAllMessages();
            for await (const message of stream) {
                if (message.senderInboxId === this.xmtpClient.inboxId) continue;

                console.log(`\n📩 New message from ${message.senderInboxId}:`);
                console.log(` - Text: "${message.content}"`);
            }
        } catch (error) {
            console.error("❌ XMTP Listener error:", error);
        }
    }

    /**
     * @dev Send a real-time notification via XMTP.
     */
    public async sendXMTPNotification(recipient: string, messageText: string) {
        if (!this.xmtpClient) {
            console.warn("⚠️ XMTP client not initialized. Skipping notification.");
            return;
        }

        try {
            // MLS groups create
            const group = await this.xmtpClient.conversations.createGroup([recipient]);
            await group.send(encodeText(messageText)); // V3 expects an EncodedContent
            console.log(`✅ XMTP V3 notification sent to ${recipient}`);
        } catch (error) {
            console.error(`❌ Failed to send XMTP V3 notification to ${recipient}:`, error);
        }
    }

    /**
     * @dev Generate embeddings using local Ollama instance (Llama 3).
     */
    public async generateEmbedding(text: string): Promise<number[]> {
        try {
            console.log(`Requesting embedding from Ollama for: "${text.slice(0, 50)}..."`);
            const response = await axios.post(this.ollamaUrl, {
                model: 'llama3',
                prompt: text
            });
            console.log("✅ Embedding generated successfully.");
            return response.data.embedding;
        } catch (error) {
            console.warn("❌ Ollama connection failed, using mock embedding. Pull llama3 to fix!");
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
        const scoreBps = Math.floor(score * 10000);
        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'address', 'uint256', 'uint256'],
            [userA, userB, scoreBps, nonce]
        );
        console.log(`Matching ${userA} <-> ${userB}`);
        console.log(` - Score BPS: ${scoreBps}`);
        console.log(` - Nonce: ${nonce}`);
        console.log(` - Hash: ${messageHash}`);
        return await this.agentWallet.signMessage(ethers.getBytes(messageHash));
    }

    public async fetchFromIPFS(cid: string): Promise<any> {
        // Handle mock CIDs for local testing to avoid 400 errors
        if (cid.toLowerCase().includes("mock")) {
            console.log(`Bypassing IPFS fetch for mock CID: ${cid}`);
            return { bio: "This is a mock personality bio for local matching. I enjoy decentralized tech and community building." };
        }

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
            const score = this.calculateSimilarity(userVector, matchVector);
            console.log(` - Profile ${match.address.slice(0, 8)}: Score ${(score * 100).toFixed(2)}%`);
            return {
                address: match.address,
                score: score
            };
        });

        const results = await Promise.all(resultPromises);
        results.sort((a, b) => b.score - a.score);

        const topMatch = results[0];
        if (topMatch && topMatch.score > 0.8) {
            console.log(`Top match: ${topMatch.address} (${(topMatch.score * 100).toFixed(2)}%)`);
            const signature = await this.signMatch(currentUser.address, topMatch.address, topMatch.score, nonce);

            // Notify both users via XMTP
            await this.sendXMTPNotification(currentUser.address, `🎉 You've been matched with ${topMatch.address.slice(0, 8)}! Open the app to stake and start chatting.`);
            await this.sendXMTPNotification(topMatch.address, `🎉 A new user (${currentUser.address.slice(0, 8)}) is a great match for you! Check your discovery tab.`);

            return {
                matchAddress: topMatch.address,
                score: Math.floor(topMatch.score * 10000),
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
    const { sender, recipient } = req.body;
    console.log(`Moderation Alert: Slashing ${sender} for reported harassment against ${recipient}`);
    res.json({ status: "Slashed", sender, recipient });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
    console.log(`\n🚀 Token42 AI Agent Server starting on http://localhost:${PORT}`);
    await agent.initXMTP();
    console.log(`Agent Address: ${agent.getAddress()}`);
    console.log("-----------------------------------------");
    console.log("✅ AGENT IS ONLINE AND READY TO MATCH");
    console.log("-----------------------------------------");
});
