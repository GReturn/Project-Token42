import { ethers } from 'ethers';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { Client, encodeText } from '@xmtp/node-sdk';
import { Buffer } from 'buffer';

dotenv.config();

const MESSAGING_CONTRACT_ADDRESS = process.env.MESSAGING_CONTRACT_ADDRESS || "0x8B8d13a7f678FA8f6793290Ee9e46302Be427453";
const MESSAGING_ABI = [
    "function slashStake(address sender, address recipient) public",
    "function matches(bytes32 matchId) public view returns (address sender, address recipient, uint256 stake, bool active)"
];

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
    private ollamaUrl = 'http://localhost:11434/api/embed';
    public xmtpClient: Client | null = null;

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
    private async sendXMTPNotification(recipientAddress: string, message: string) {
        try {
            if (!this.xmtpClient) return;
            const cleanAddr = recipientAddress.toLowerCase();

            // Resolve Ethereum address to XMTP inbox ID (createDm requires inbox ID, not address)
            const { createBackend, getInboxIdForIdentifier } = await import('@xmtp/node-sdk');
            const backend = await createBackend({ env: "dev" });
            let inboxId = await getInboxIdForIdentifier(backend, {
                identifier: cleanAddr,
                identifierKind: 0 as any
            });

            if (!inboxId) {
                console.warn(`⚠️ No XMTP identity found for ${cleanAddr}, skipping notification.`);
                return;
            }

            console.log(`📬 Resolved inbox ID for ${cleanAddr}: ${inboxId.substring(0, 12)}...`);
            const conversation = await this.xmtpClient.conversations.createDm(inboxId);
            const encoded = await encodeText(message);
            await conversation.send(encoded);
            console.log(`✅ XMTP V3 notification sent to ${cleanAddr}`);
        } catch (error) {
            // This is often a transient network error on Dev network
            console.warn(`⚠️ Match response was successful, but background XMTP notification to ${recipientAddress} failed. This won't affect the user's ability to chat.`);
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
                input: text
            });
            console.log("✅ Embedding generated successfully.");
            // Ollama /api/embed returns an array of embeddings
            return response.data.embeddings[0];
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
        if (topMatch && topMatch.score > 0.7) {
            console.log(`Top match: ${topMatch.address} (${(topMatch.score * 100).toFixed(2)}%)`);
            const signature = await this.signMatch(currentUser.address, topMatch.address, topMatch.score, nonce);

            // Notify both users via XMTP
            await this.sendXMTPNotification(currentUser.address, `🎉 You've been matched with ${topMatch.address.slice(0, 8)}! Open the app to stake and start chatting.`);
            await this.sendXMTPNotification(topMatch.address, `🎉 A new user (${currentUser.address.slice(0, 8)}) is a great match for you! Check your discovery tab.`);

            return {
                matchAddress: topMatch.address,
                score: Math.floor(topMatch.score * 10000),
                signature: signature,
                agentInboxId: this.xmtpClient?.inboxId
            };
        }

        return null;
    }

    /**
     * @dev Evaluate chat history for policy violations using Ollama.
     */
    public async evaluateChat(chatHistory: any[]): Promise<boolean> {
        try {
            if (!chatHistory || chatHistory.length === 0) return false;

            const formattedChat = chatHistory.map((m: any) => `${m.sent ? 'Reporter' : 'Reported'}: ${m.text}`).join('\n');
            const prompt = `Evaluate the following chat conversation for any signs of harassment, abuse, or severe behavior. 
Reply with ONLY the word "VIOLATION" if there is a breach of conduct, or "SAFE" if acceptable.

--- CHAT START ---
${formattedChat}
--- CHAT END ---

Decision (VIOLATION or SAFE):`;

            console.log("Analyzing chat with Ollama...");
            const response = await axios.post('http://localhost:11434/api/generate', {
                model: 'llama3',
                prompt: prompt,
                stream: false
            });

            const result = response.data.response || "";
            const resultClean = result.trim().toUpperCase();
            console.log(`Ollama Evaluation: ${resultClean}`);
            return resultClean.includes("VIOLATION");
        } catch (error) {
            console.error("❌ Evaluation failed:", error);
            return false;
        }
    }

    /**
     * @dev Execute on-chain slashStake.
     */
    public async triggerSlash(sender: string, recipient: string): Promise<boolean> {
        try {
            const provider = new ethers.JsonRpcProvider('https://eth-rpc-testnet.polkadot.io');
            const connectedWallet = this.agentWallet.connect(provider);
            const messagingContract = new ethers.Contract(MESSAGING_CONTRACT_ADDRESS, MESSAGING_ABI, connectedWallet);

            // Lookup active match
            const matchId1 = ethers.solidityPackedKeccak256(["address", "address"], [sender, recipient]);
            const match1 = await messagingContract.matches(matchId1);
            
            const matchId2 = ethers.solidityPackedKeccak256(["address", "address"], [recipient, sender]);
            const match2 = await messagingContract.matches(matchId2);

            let matchSender = null;
            let matchRecipient = null;

            if (match1.active && match1.stake > 0n) {
                matchSender = sender;
                matchRecipient = recipient;
            } else if (match2.active && match2.stake > 0n) {
                matchSender = recipient;
                matchRecipient = sender;
            }

            if (matchSender && matchRecipient) {
                console.log(`Found active match with stake. Triggering slashStake(${matchSender}, ${matchRecipient})`);
                const tx = await messagingContract.slashStake(matchSender, matchRecipient);
                await tx.wait();
                console.log("✅ Slash transaction confirmed.");
                return true;
            } else {
                console.warn("No active match with stake found to slash.");
                return false;
            }
        } catch (error) {
            console.error("❌ Slash execution failed:", error);
            return false;
        }
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
    console.log("📥 Received /match request");
    try {
        const { currentUser, potentialMatches, nonce } = req.body;
        console.log(`- Current User: ${currentUser.address}`);
        console.log(`- Potential Matches Count: ${potentialMatches?.length || 0}`);
        const result = await agent.handleMatchRequest(currentUser, potentialMatches, nonce);
        console.log("📤 Sending /match response:", result ? "Match Found" : "No Match");
        res.json(result);
    } catch (error: any) {
        console.error("❌ Error in /match route:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/info', (req, res) => {
    res.json({ agentInboxId: agent.xmtpClient?.inboxId });
});

app.post('/report', async (req, res) => {
    const { sender, recipient, chatHistory } = req.body;
    console.log(`📥 Received report from ${sender} against ${recipient}`);
    
    try {
        const isViolation = await agent.evaluateChat(chatHistory || []);
        
        if (isViolation) {
            console.log(`🚨 Violation detected. Triggering on-chain slash for match...`);
            const success = await agent.triggerSlash(sender, recipient);
            if (success) {
                return res.json({ status: "Slashed", message: "Violation verified. Stake slashed." });
            } else {
                return res.json({ status: "Error", message: "Violation detected but slash execution failed." });
            }
        } else {
            console.log(`✅ Chat evaluated as SAFE.`);
            return res.json({ status: "Safe", message: "Chat content does not violate policies." });
        }
    } catch (e: any) {
        console.error("❌ Error in /report:", e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n🚀 Token42 AI Agent Server starting on http://localhost:${PORT}`);
    await agent.initXMTP();
    console.log(`Agent Address: ${agent.getAddress()}`);
    console.log("-----------------------------------------");
    console.log("✅ AGENT IS ONLINE AND READY TO MATCH");
    console.log("-----------------------------------------");
});
