import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { Client, encodeText, createBackend, getInboxIdForIdentifier } from '@xmtp/browser-sdk';
import { uploadToIPFS, fetchFromIPFS, fetchImageFromIPFS, UserProfile } from './utils/storage';
import { STORAGE_CONFIG } from './config/storage';
import { toast, Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Loading from './components/Loading';
import GlassCard from './components/GlassCard';
import StatusBadge from './components/StatusBadge';
import PoRLModal from './components/PoRLModal';
import { compressImage, getCroppedImg } from './utils/images';
import Cropper from 'react-easy-crop';

// Contract Addresses (Paseo Asset Hub - PolkaVM)
const PROFILE_CONTRACT_ADDRESS = "0x9B9f7569A535Cd2B66EC9B2F5509F5e688Ba92B5";
const MESSAGING_CONTRACT_ADDRESS = "0x8B8d13a7f678FA8f6793290Ee9e46302Be427453";
const ESCROW_CONTRACT_ADDRESS = "0xb6B64176CC8a8350AB84D466CD4bf111C3A6E7a5";
const RUSD_CONTRACT_ADDRESS = "0xFE4eae5d84412B70b1f04b3F78351a654D28Da25";

const PROFILE_ABI = [
  "function mintProfile(string cid) public",
  "function updateProfile(string newCid) public",
  "function hasProfile(address user) public view returns (bool)",
  "function getProfileCID(address user) public view returns (string)",
  "function ownerOf(uint256 tokenId) public view returns (address)"
];

const MESSAGING_ABI = [
  "function stakeForMessage(address recipient, uint256 matchScore, bytes signature) public",
  "function claimStake(address sender) public",
  "function slashStake(address sender, address recipient) public",
  "function burnForReveal(address recipient) public",
  "function nonces(address user) public view returns (uint256)",
  "function matches(bytes32 matchId) public view returns (address sender, address recipient, uint256 stake, bool active)",
  "event RevealPurchased(address indexed sender, address indexed recipient, uint256 amount)",
  "event MessageStaked(address indexed sender, address indexed recipient, uint256 amount, uint256 nonce)"
];

const ESCROW_ABI = [
  "function proposeDate(address recipient) public",
  "function acceptDate(address proposer) public",
  "function submitProof(address partner, bytes signature) public",
  "function dates(bytes32 dateId) public view returns (address userA, address userB, uint256 startTime, uint256 amountA, uint256 amountB, bool proofA, bool proofB, uint8 status)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function faucet() public"
];

function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [step, setStep] = useState<'connect' | 'profile' | 'matching' | 'chat'>('connect');
  const [isVerified, setIsVerified] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    bio: '',
    interests: [],
    timestamp: 0,
    creator: ''
  });
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [userCID, setUserCID] = useState<string | null>(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [isMobileSessionOpen, setIsMobileSessionOpen] = useState(false);
  const [revealedUsers, setRevealedUsers] = useState<Set<string>>(new Set());
  const [dateEscrowStatus, setDateEscrowStatus] = useState<any>(null);
  const [isPoRLModalOpen, setIsPoRLModalOpen] = useState(false);
  const [isMatchLockModalOpen, setIsMatchLockModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Record<string, { text: string; sent: boolean }[]>>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [initialProfile, setInitialProfile] = useState<UserProfile | null>(null);
  const [xmtpClient, setXmtpClient] = useState<Client | null>(null);
  const [rusdBalance, setRusdBalance] = useState<string>("0");
  const [isXmtpLoading, setIsXmtpLoading] = useState(false);
  const [showRecipientBio, setShowRecipientBio] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [hasActiveStake, setHasActiveStake] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [pendingAvatarBlob, setPendingAvatarBlob] = useState<Blob | null>(null);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [cachedAvatarUrls, setCachedAvatarUrls] = useState<Record<string, string>>({});
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitializingXmtp = useRef(false);
  const topicToAddress = useRef<Record<string, string>>({});
  const addressToInboxId = useRef<Record<string, string>>({});

  const resolveInboxId = async (targetAddress: string) => {
    const lowerAddr = targetAddress.toLowerCase();
    if (addressToInboxId.current[lowerAddr]) return addressToInboxId.current[lowerAddr];
    
    console.log("Resolving Inbox ID for:", lowerAddr);
    try {
      const backend = await createBackend({ env: "dev" });
      
      // Try with 0x first (Standard)
      let inboxId = await getInboxIdForIdentifier(backend, {
        identifier: lowerAddr,
        identifierKind: 0 as any
      });

      if (!inboxId) {
        console.log("Identity not found with 0x prefix, trying raw hex...");
        inboxId = await getInboxIdForIdentifier(backend, {
          identifier: lowerAddr.replace('0x', ''),
          identifierKind: 0 as any
        });
      }
      
      if (inboxId) {
        console.log("✅ Resolved Inbox ID:", inboxId);
        addressToInboxId.current[lowerAddr] = inboxId;
        return inboxId;
      }
    } catch (e) {
      console.error("Inbox ID resolution failed:", e);
    }
    return null;
  };

  const isXmtpSoftSuccess = (error: any) => {
    if (!error) return false;
    const msg = error.message || String(error);
    return msg.includes("[GroupError::Sync]") && msg.includes("0 failed");
  };

  const MAX_CHAT_CHARS = 500;

  useEffect(() => {
    if (address) {
      checkNetwork();
      checkProfileStatus();
      loadPersistedData();
      updateBalance();
    }
  }, [address]);

  // Persist Chats
  useEffect(() => {
    if (address && Object.keys(chatMessages).length > 0) {
      localStorage.setItem(`chats_${address.toLowerCase()}`, JSON.stringify(chatMessages));
    }
  }, [chatMessages, address]);

  // Persist Matches
  useEffect(() => {
    if (address && matches.length > 0) {
      localStorage.setItem(`matches_${address.toLowerCase()}`, JSON.stringify(matches));
    }
  }, [matches, address]);

  const loadPersistedData = async () => {
    if (!address) return;
    
    // Load Matches
    const savedMatches = localStorage.getItem(`matches_${address.toLowerCase()}`);
    if (savedMatches) {
      try {
        const parsed = JSON.parse(savedMatches);
        setMatches(parsed);
        // Resolve images for matches
        parsed.forEach(async (m: any) => {
          if (m.avatar) {
            const url = await fetchImageFromIPFS(m.avatar);
            setCachedAvatarUrls(prev => ({ ...prev, [m.avatar]: url }));
          }
        });
      } catch (e) { console.error("Failed to load saved matches", e); }
    }

    // Load Chats
    const savedChats = localStorage.getItem(`chats_${address.toLowerCase()}`);
    if (savedChats) {
      try {
        const parsed = JSON.parse(savedChats);
        setChatMessages(parsed);
        
        // Resolve Recipient Profiles
        const recipients = Object.keys(parsed);
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const profileContract = new ethers.Contract(PROFILE_CONTRACT_ADDRESS, PROFILE_ABI, provider);
        
        recipients.forEach(async (addr) => {
          try {
            const cid = await profileContract.getProfileCID(addr);
            if (cid) {
              const metadata = await fetchFromIPFS(cid); // Uses JSON cache
              if (metadata.avatar) {
                const url = await fetchImageFromIPFS(metadata.avatar); // Uses Image cache
                setCachedAvatarUrls(prev => ({ ...prev, [metadata.avatar!]: url }));
              }
            }
          } catch (err) {
            console.error(`Failed to resolve profile for ${addr}`, err);
          }
        });
      } catch (e) { console.error("Failed to load saved chats", e); }
    }

    // Recover on-chain stakes
    await recoverLegacyStakes();
  };

  const recoverLegacyStakes = async () => {
    if (!address) return;
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const messaging = new ethers.Contract(MESSAGING_CONTRACT_ADDRESS, MESSAGING_ABI, provider);
      
      // Get stakes we SENT
      // Fetch all MessageStaked events for the last 5000 blocks and filter locally
      // This avoids RPC compatibility issues with 'null' wildcards in topic filters.
      const filter = messaging.filters.MessageStaked();
      const recentEvents = await messaging.queryFilter(filter, -5000);

      const allEvents = recentEvents.filter((event: any) => {
        if (!event.args) return false;
        const sender = event.args.sender.toLowerCase();
        const recipient = event.args.recipient.toLowerCase();
        const myAddr = address.toLowerCase();
        return sender === myAddr || recipient === myAddr;
      });

      if (allEvents.length > 0) {
        console.log(`Found ${allEvents.length} relevant on-chain stakes.`);
        const profileContract = new ethers.Contract(PROFILE_CONTRACT_ADDRESS, PROFILE_ABI, provider);
        
        const newChats: Record<string, any[]> = { ...chatMessages };
        let changed = false;

        for (const event of allEvents) {
          const log = event as any;
          if (log.args) {
            const sender = log.args.sender;
            const recipient = log.args.recipient;
            const partner = sender.toLowerCase() === address.toLowerCase() ? recipient.toLowerCase() : sender.toLowerCase();
            
            // Note: chatMessages keys are generally stored lowercase for easier matching, 
            // but the app uses mixed case in some places. Let's try to normalize or check both.
            const existingKeys = Object.keys(newChats).map(k => k.toLowerCase());
            
            if (!existingKeys.includes(partner)) {
              console.log("Restoring session for partner:", partner);
              const checksummedPartner = ethers.getAddress(partner);
              newChats[checksummedPartner] = [];
              changed = true;
              
              try {
                const cid = await profileContract.getProfileCID(checksummedPartner);
                if (cid) {
                  const metadata = await fetchFromIPFS(cid);
                  if (metadata.avatar) {
                    const url = await fetchImageFromIPFS(metadata.avatar);
                    setCachedAvatarUrls(prev => ({ ...prev, [metadata.avatar!]: url }));
                  }
                  setMatches(prev => {
                    if (prev.some(m => m.matchAddress.toLowerCase() === partner)) return prev;
                    return [...prev, {
                      matchAddress: checksummedPartner,
                      matchBio: metadata.bio,
                      matchName: metadata.name,
                      avatar: metadata.avatar,
                      score: 10000 
                    }];
                  });
                }
              } catch (e) {
                console.warn("Match metadata restoration failed for", partner);
              }
            }
          }
        }
        if (changed) setChatMessages(newChats);
      }
    } catch (e) {
      console.error("Legacy stake recovery failed:", e);
    }
  };

  const checkNetwork = async () => {
    if (!(window as any).ethereum) return;
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      // Paseo Asset Hub Chain ID is 420420417
      if (chainId !== 420420417) {
        setIsWrongNetwork(true);
      } else {
        setIsWrongNetwork(false);
      }
    } catch (e) {
      console.error("Network check failed:", e);
    }
  };

  const switchNetwork = async () => {
    try {
      await (window as any).ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x19191911', // 420420417
          chainName: 'Paseo Asset Hub',
          nativeCurrency: { name: 'PAS', symbol: 'PAS', decimals: 18 },
          rpcUrls: ['https://eth-rpc-testnet.polkadot.io'],
          blockExplorerUrls: ['https://paseo-asset-hub.subscan.io']
        }]
      });
      setIsWrongNetwork(false);
      checkProfileStatus();
    } catch (e) {
      console.error("Switch network failed:", e);
      alert("Please manually switch your wallet to Paseo Asset Hub.");
    }
  };

  const checkProfileStatus = async () => {
    if (!address) return;
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const profileContract = new ethers.Contract(PROFILE_CONTRACT_ADDRESS, PROFILE_ABI, provider);
      const exists = await profileContract.hasProfile(address);
      if (exists) {
        const cid = await profileContract.getProfileCID(address);
        setUserCID(cid);
        const metadata = await fetchFromIPFS(cid);
        setProfile(metadata);
        setInitialProfile(metadata);
        if (step === 'connect') setStep('matching');
      }
    } catch (e) { console.error("Profile check failed", e); }
  };

  const updateBalance = async () => {
    if (!address) return;
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const rUSD = new ethers.Contract(RUSD_CONTRACT_ADDRESS, [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ], provider);
      const balance = await rUSD.balanceOf(address);
      setRusdBalance(ethers.formatEther(balance));
    } catch (e) {
      console.error("Failed to update rUSD balance:", e);
    }
  };

  const getFaucetrUSD = async () => {
    if (!address) return;
    const toastId = toast.loading("Requesting test rUSD...");
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const rUSD = new ethers.Contract(RUSD_CONTRACT_ADDRESS, [
        "function faucet() public"
      ], signer);
      
      const tx = await rUSD.faucet();
      setTxHash(tx.hash);
      await tx.wait();
      
      toast.success("100 rUSD received!", { id: toastId });
      updateBalance();
    } catch (error: any) {
      console.error("Faucet failed:", error);
      toast.error(`Faucet failed: ${error.message || "Unknown error"}`, { id: toastId });
    } finally {
      setLoading(false);
    }  };

  const connectWallet = async () => {
    if ((window as any).ethereum) {
      setIsConnecting(true);
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        setAddress(ethers.getAddress(accounts[0]));
      } catch (error) {
        console.error("Connection failed:", error);
      } finally {
        setIsConnecting(false);
      }
    } else {
      alert("Please install SubWallet or MetaMask!");
    }
  };

  const initXMTP = async () => {
    if (!address || xmtpClient || isInitializingXmtp.current) return;
    setIsXmtpLoading(true);
    isInitializingXmtp.current = true;
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      console.log("Initializing XMTP V3 client with persistent DB...");
      
      // Wrap Ethers signer for XMTP V3
      const xmtpSigner = {
        type: 'EOA' as const,
        getIdentifier: async () => ({
          identifier: await signer.getAddress(), // Use standard checksummed address (with 0x)
          identifierKind: 0 as any
        }),
        signMessage: async (message: string) => {
          const sig = await signer.signMessage(message);
          return ethers.getBytes(sig);
        }
      };

      const client = await Client.create(xmtpSigner as any, { 
        env: "dev",
        dbPath: `token42-${address.toLowerCase()}.db`
      } as any);
      
      setXmtpClient(client);
      console.log("🆔 Client Inbox ID:", client.inboxId);
      console.log("✅ XMTP V3 initialized for:", address);
      toast.success("Real-time messaging active!");
    } catch (error: any) {
      console.error("XMTP V3 initialization failed:", error);
      if (error.message?.includes("Access Handles cannot be created")) {
        toast.error("Storage locked. Please close other browser tabs.", { duration: 5000 });
      } else if (error.message?.includes("already registered 10/10 installations")) {
        toast.error("Session limit reached. Use 'Rescue XMTP' in Profile.", { duration: 6000 });
      } else {
        toast.error("Failed to enable real-time messaging");
      }
    } finally {
      setIsXmtpLoading(false);
      isInitializingXmtp.current = false;
    }
  };

  const revokeXmtpInstallations = async () => {
    if (!address) return;
    const toastId = toast.loading("Performing Emergency Rescue (v2)...");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();

      // v2 logic: use static methods that don't need a local DB instance
      console.log("🚀 Starting Static Revocation Flow...");
      const backend = await createBackend({ env: "dev" });

      // Dual-lookup strategy: Try with 0x prefix first, then without
      let usedAddress = walletAddress;
      let inboxId = await getInboxIdForIdentifier(backend, {
        identifier: usedAddress,
        identifierKind: 0
      });

      if (!inboxId) {
        console.log("Identity not found with 0x, trying raw hex...");
        usedAddress = walletAddress.toLowerCase().replace('0x', '');
        inboxId = await getInboxIdForIdentifier(backend, {
          identifier: usedAddress,
          identifierKind: 0
        });
      }

      if (!inboxId) {
        toast.error("No XMTP identity found on network.", { id: toastId });
        return;
      }

      // Re-initialize ephemeral signer with the detected address format
      const xmtpSigner = {
        type: 'EOA' as const,
        getIdentifier: async () => ({
          identifier: walletAddress, // Keep the original walletAddress for the signer (local validation)
          identifierKind: 0 as any
        }),
        signMessage: async (message: string) => {
          const sig = await signer.signMessage(message);
          return ethers.getBytes(sig);
        }
      };

      console.log("Found Inbox ID:", inboxId);
      const states = await Client.fetchInboxStates([inboxId], backend);
      const inboxState = states[0];
      
      if (!inboxState || inboxState.installations.length === 0) {
        toast.success("No active installations to revoke!", { id: toastId });
        return;
      }

      const installationIds = inboxState.installations.map(inst => inst.bytes);
      console.log(`Revoking ${installationIds.length} installations...`);

      // Static revoke (requires signer + inboxId + array of IDs)
      await Client.revokeInstallations(xmtpSigner as any, inboxId, installationIds, backend);
      
      toast.success("Network sessions cleared! Now click 'Clear XMTP DB' then refresh.", { id: toastId, duration: 8000 });
    } catch (error: any) {
      console.error("Rescue v2 failed:", error);
      toast.error(`Force rescue failed: ${error.message}. Use 'Clear XMTP DB' and refresh first.`, { id: toastId, duration: 10000 });
    }
  };

  // Deletes all XMTP .db files from the browser's OPFS (Origin Private File System).
  // This is NOT localStorage — XMTP V3 stores encrypted DB files in a sandboxed filesystem.
  // This only affects this site (localhost) and does not touch cookies or other sites.
  const clearXmtpOpfs = async () => {
    const toastId = toast.loading("Clearing XMTP local database...");
    try {
      const root = await navigator.storage.getDirectory();
      const filesToDelete: string[] = [];

      // List all entries in OPFS root
      for await (const [name] of (root as any).entries()) {
        if (name.endsWith('.db') || name.startsWith('token42-')) {
          filesToDelete.push(name);
        }
      }

      if (filesToDelete.length === 0) {
        toast.success("No XMTP database files found.", { id: toastId });
        return;
      }

      for (const name of filesToDelete) {
        await root.removeEntry(name, { recursive: true });
        console.log(`Deleted OPFS entry: ${name}`);
      }

      toast.success(`Cleared ${filesToDelete.length} XMTP DB file(s). Please refresh.`, { id: toastId });
    } catch (error: any) {
      console.error("OPFS clear failed:", error);
      toast.error(`Failed to clear: ${error.message}`, { id: toastId });
    }
  };

  // Trigger XMTP init when address is set
  useEffect(() => {
    if (address && !xmtpClient) {
      initXMTP();
    }
  }, [address]);

  // Stream XMTP messages
  useEffect(() => {
    if (!xmtpClient) return;

    let isTerminated = false;
    let syncInterval: any;

    const startStreaming = async () => {
      try {
        await xmtpClient.conversations.sync();
        console.log("✅ XMTP V3 initial sync complete.");

        syncInterval = setInterval(async () => {
          if (isTerminated) return;
          try {
            await xmtpClient.conversations.sync();
          } catch (e) {
            console.warn("Background sync failed:", e);
          }
        }, 15000);

        // Helper to resolve sender address from a group topic
        const resolveSender = async (groupOrTopic: any) => {
          const topic = typeof groupOrTopic === 'string' ? groupOrTopic : groupOrTopic.topic;
          if (topicToAddress.current[topic]) return topicToAddress.current[topic];
          
          try {
            const group = typeof groupOrTopic === 'string' 
              ? (await xmtpClient.conversations.list()).find((g: any) => g.topic === topic)
              : groupOrTopic;

            if (group) {
              try {
                await group.sync();
              } catch (syncErr) {
                console.warn(`Resolution sync failed for ${topic.substring(0, 8)}, trying members anyway...`);
              }
              const members = await group.members();
              const otherMember = members.find((m: any) => m.inboxId !== xmtpClient.inboxId);
              if (otherMember && (otherMember as any).accountAddresses.length > 0) {
                const addr = ethers.getAddress((otherMember as any).accountAddresses[0]);
                topicToAddress.current[topic] = addr;
                return addr;
              }
            }
          } catch (e) {
            console.error("Failed to resolve sender for topic:", topic, e);
          }
          return null;
        };

        // 0. Reconstruct existing conversations from identifying the inbox identities on the network
        const reconstructConversations = async () => {
          try {
            console.log("🔍 Reconstructing conversations from network...");
            const existingConvs = await xmtpClient.conversations.list();
            console.log(`Found ${existingConvs.length} existing conversations:`, existingConvs.map(c => c.id.substring(0, 8)));

            for (const conv of existingConvs) {
              try {
                console.log(`Processing group: ${conv.id.substring(0, 8)}...`);
                const partnerAddress = await resolveSender(conv);
                console.log(`Group ${conv.id.substring(0, 8)}: Partner is ${partnerAddress || "Unknown"}`);
                if (partnerAddress) {
                  console.log(`Restoring network conversation with ${partnerAddress}`);
                  
                  // Initialize message state if missing
                  setChatMessages(prev => {
                    if (prev[partnerAddress]) return prev;
                    return { ...prev, [partnerAddress]: [] };
                  });

                  // Sync the group to fetch messages
                  try {
                    console.log(`Syncing group ${conv.id.substring(0, 8)}...`);
                    await conv.sync();
                    console.log(`Group ${conv.id.substring(0, 8)} synced.`);
                  } catch (syncErr) {
                    console.warn(`Sync failed for group ${conv.id.substring(0, 8)}, skipping messages for now.`, syncErr);
                  }

                  // Trigger profile resolution for the chat list
                  try {
                    const provider = new ethers.BrowserProvider((window as any).ethereum);
                    const profileContract = new ethers.Contract(PROFILE_CONTRACT_ADDRESS, PROFILE_ABI, provider);
                    const cid = await profileContract.getProfileCID(partnerAddress);
                    if (cid) {
                      const metadata = await fetchFromIPFS(cid);
                      setMatches(prev => {
                        if (prev.some(m => m.matchAddress.toLowerCase() === partnerAddress.toLowerCase())) return prev;
                        return [...prev, {
                          matchAddress: partnerAddress,
                          matchName: metadata.name,
                          matchBio: metadata.bio,
                          avatar: metadata.avatar,
                          score: 10000
                        }];
                      });
                    }
                  } catch (e) {
                    console.warn("Match metadata restoration failed for", partnerAddress);
                  }
                } else {
                  console.warn(`Could not resolve partner for group ${conv.id.substring(0, 8)}`);
                }
              } catch (convErr) {
                console.error(`Failed to process group ${conv.id.substring(0, 8)} during reconstruction:`, convErr);
              }
            }
            console.log("✅ Conversation reconstruction complete.");
          } catch (e) {
            console.error("Failed to reconstruct conversations:", e);
          }
        };
        await reconstructConversations();

        // 1. Stream Conversations (to detect NEW DMs)
        const runConvStream = async () => {
          while (!isTerminated) {
            try {
              const convStream = await xmtpClient.conversations.stream();
              console.log("Listening for new XMTP conversations...");
              for await (const conversation of convStream) {
                if (isTerminated) break;
                console.log("New conversation detected:", conversation.id);
                await conversation.sync();
                
                const members = await conversation.members();
                const otherMember = members.find((m: any) => m.inboxId !== xmtpClient.inboxId);
                if (otherMember && (otherMember as any).accountAddresses.length > 0) {
                  const partnerAddress = ethers.getAddress((otherMember as any).accountAddresses[0]);
                  topicToAddress.current[conversation.topic] = partnerAddress;
                  
                  setChatMessages(prev => {
                    if (prev[partnerAddress]) return prev;
                    return { ...prev, [partnerAddress]: [] };
                  });
                  
                  // Trigger profile resolution
                  try {
                    const provider = new ethers.BrowserProvider((window as any).ethereum);
                    const profileContract = new ethers.Contract(PROFILE_CONTRACT_ADDRESS, PROFILE_ABI, provider);
                    const cid = await profileContract.getProfileCID(partnerAddress);
                    if (cid) {
                      const metadata = await fetchFromIPFS(cid);
                      setMatches(prev => {
                        if (prev.some(m => m.matchAddress.toLowerCase() === partnerAddress.toLowerCase())) return prev;
                        return [...prev, {
                          matchAddress: partnerAddress,
                          matchName: metadata.name,
                          matchBio: metadata.bio,
                          avatar: metadata.avatar,
                          score: 10000
                        }];
                      });
                    }
                  } catch (e) { console.warn("Failed to resolve profile for new conversation:", partnerAddress); }
                }
              }
            } catch (e) {
              if (isTerminated) break;
              console.warn("Conversation stream died, reconnecting...", e);
              await new Promise(r => setTimeout(r, 3000));
            }
          }
        };
        runConvStream();

        // 2. Stream Messages
        while (!isTerminated) {
          try {
            const messageStream = await xmtpClient.conversations.streamAllMessages();
            console.log("Listening for XMTP V3 messages...");
            
            for await (const message of messageStream) {
              if (isTerminated) break;
              console.log(`Streamed raw message detected: ${message.id} in group ${(message as any).contentTopic || (message as any).topic}`);
              if (message.senderInboxId === xmtpClient.inboxId) {
                console.log("Skipping own message");
                continue;
              }

              // Optimization: Resolve sender using the message's group if available
              const groupRef = (message as any).group || (message as any).topic || (message as any).groupTopic;
              
              if (!groupRef) {
                console.warn("Message detected but no group/topic context found:", message.id);
                continue;
              }

              console.log("Resolving sender for groupRef:", groupRef);
              const senderAddress = await resolveSender(groupRef);
              
              if (senderAddress) {
                // Robust Content Decoding
                let text = "";
                const content = message.content;

                if (typeof content === 'string') {
                  text = content;
                } else if (content instanceof Uint8Array) {
                  text = new TextDecoder().decode(content);
                } else if (content && typeof content === 'object') {
                  // Try to extract text from object (SDK decoded)
                  text = (content as any).text || (content as any).body || JSON.stringify(content);
                } else {
                  console.warn("Received unknown message content type:", typeof content);
                  continue;
                }

                console.log(`Received message from ${senderAddress}:`, text);

                setChatMessages(prev => {
                  const existing = prev[senderAddress] || [];
                  // Prevent duplicates if optimistic update already added it
                  if (existing.some((m: any) => m.text === text)) return prev;
                  return {
                    ...prev,
                    [senderAddress]: [...existing, { text, sent: false }]
                  };
                });
              }
            }
          } catch (e) {
            if (isTerminated) break;
            console.warn("Message stream died, reconnecting...", e);
            await new Promise(r => setTimeout(r, 3000));
          }
        }
      } catch (err) {
        if (!isTerminated) console.error("XMTP Streaming error:", err);
      }
    };

    startStreaming();

    return () => {
      isTerminated = true;
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [xmtpClient]);

  // Check stake status when active chat changes
  useEffect(() => {
    if (activeChat && address) {
      checkStakeStatus(activeChat);
    }
  }, [activeChat, address]);

  const checkStakeStatus = async (partner: string) => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const messaging = new ethers.Contract(MESSAGING_CONTRACT_ADDRESS, MESSAGING_ABI, provider);
      
      // matchId = keccak256(abi.encodePacked(sender, recipient))
      // In this case, we are the recipient, and partner is the sender
      const matchId = ethers.keccak256(ethers.solidityPacked(["address", "address"], [partner, address]));
      const stakeInfo = await messaging.matches(matchId);
      
      setHasActiveStake(stakeInfo.active && stakeInfo.recipient.toLowerCase() === address?.toLowerCase());
    } catch (e) {
      console.error("Failed to check stake status:", e);
      setHasActiveStake(false);
    }
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropConfirm = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    try {
      setLoading(true);
      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setPendingAvatarBlob(croppedBlob);
      setLocalAvatarPreview(URL.createObjectURL(croppedBlob));
      setImageToCrop(null);
      toast.success("Image cropped! Save profile to store it permanently.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to crop image");
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    if (!address || !profile.bio) return toast.error("Please enter a bio");
    const toastId = toast.loading("Preparing profile...");
    setLoading(true);
    try {
      let finalAvatarCID = profile.avatar;

      if (pendingAvatarBlob) {
        toast.loading("Uploading image to IPFS...", { id: toastId });
        const formData = new FormData();
        formData.append('file', pendingAvatarBlob, 'avatar.jpg');
        
        const pinataMetadata = JSON.stringify({
          name: `Token42_Avatar_${address.slice(0, 6)}`,
        });
        formData.append('pinataMetadata', pinataMetadata);
        
        const options = JSON.stringify({ cidVersion: 0 });
        formData.append('pinataOptions', options);

        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STORAGE_CONFIG.PINATA_JWT}`,
          },
          body: formData,
        });

        if (!response.ok) throw new Error('Avatar upload failed');
        const result = await response.json();
        finalAvatarCID = result.IpfsHash;

        // Verification: Check if image is reachable on gateway (opinion without webhooks)
        toast.loading("Verifying image reachability...", { id: toastId });
        let verified = false;
        for (let i = 0; i < 3; i++) {
          try {
            const check = await fetch(`https://gateway.pinata.cloud/ipfs/${finalAvatarCID}`, { method: 'HEAD' });
            if (check.ok) {
              verified = true;
              break;
            }
          } catch (e) {
            console.warn("Reachability check failed, retrying...");
          }
          await new Promise(r => setTimeout(r, 1500));
        }
        if (!verified) console.warn("Image uploaded but not yet reachable via gateway. It will appear shortly.");
      }

      toast.loading("Uploading metadata...", { id: toastId });
      const metadata: UserProfile = {
        ...profile,
        avatar: finalAvatarCID,
        timestamp: Date.now(),
        creator: address
      };
      const cid = await uploadToIPFS(address, metadata);
      console.log("IPFS CID:", cid);

      toast.loading("Waiting for blockchain confirm...", { id: toastId });
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const profileContract = new ethers.Contract(PROFILE_CONTRACT_ADDRESS, PROFILE_ABI, signer);

      let tx;
      if (userCID) {
        console.log("Updating existing profile...");
        tx = await profileContract.updateProfile(cid);
      } else {
        console.log("Minting new soulbound profile...");
        tx = await profileContract.mintProfile(cid);
      }

      setTxHash(tx.hash);
      await tx.wait();
      
      // Prime Caches
      localStorage.setItem(`ipfs_json_${cid}`, JSON.stringify(metadata));


      setUserCID(cid);
      setProfile(metadata);
      setInitialProfile(metadata);
      setPendingAvatarBlob(null);
      setLocalAvatarPreview(null);
      toast.success(userCID ? "Profile Updated!" : "Soulbound Profile Minted!", { id: toastId });
      setStep('matching');
    } catch (error: any) {
      console.error("Profile operation failed:", error);
      toast.error(`Error: ${error.message || "Unknown error"}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const findMatches = async () => {
    if (!address || !userCID) return;
    const toastId = toast.loading("Discovering potential matches...");
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const profileContract = new ethers.Contract(PROFILE_CONTRACT_ADDRESS, PROFILE_ABI, provider);
      
      const potentialMatches: any[] = [];
      let tokenId = 1;
      let consecutiveErrors = 0;

      // Discover profiles by iterating through token IDs
      // We stop after 3 consecutive errors (presumably no more profiles)
      while (consecutiveErrors < 3) {
          try {
              // We use a manual call to avoid the standard error handling if possible,
              // or just accept that the try-catch will handle it.
              const owner = await profileContract.ownerOf(tokenId);
              const ownerAddr = owner.toLowerCase();
                if (ownerAddr !== address.toLowerCase()) {
                    // Filter out already staked recipients (those we already have a session with)
                    const lowerChatKeys = Object.keys(chatMessages).map(k => k.toLowerCase());
                    if (!lowerChatKeys.includes(ownerAddr)) {
                        const cid = await profileContract.getProfileCID(owner);
                        potentialMatches.push({ address: owner, cid });
                    }
                }
              consecutiveErrors = 0;
          } catch (e: any) {
              // Ignore "TokenDoesNotExist" or similar errors as they indicate end of list
              consecutiveErrors++;
          }
          tokenId++;
          if (tokenId > 50) break; // Reduced cap for faster local discovery
      }

      if (potentialMatches.length === 0) {
        toast.error("No other profiles found to match with.", { id: toastId });
        return;
      }

      toast.loading(`Analyzing ${potentialMatches.length} profiles...`, { id: toastId });
      
      const messagingContract = new ethers.Contract(MESSAGING_CONTRACT_ADDRESS, MESSAGING_ABI, provider);
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

      if (!response.ok) throw new Error("Agent failed to respond");

      const data = await response.json();
      if (data) {
        // Fetch full metadata for the match to get the avatar
        try {
          const metadata = await fetchFromIPFS(data.matchCid || potentialMatches.find(m => m.address === data.matchAddress)?.cid);
          setMatches([{ 
            ...data, 
            avatar: metadata.avatar,
            name: metadata.name,
            bio: metadata.bio
          }]);
          
          if (metadata.avatar) {
            const url = await fetchImageFromIPFS(metadata.avatar);
            setCachedAvatarUrls(prev => ({ ...prev, [metadata.avatar!]: url }));
          }
          toast.success("Match found!", { id: toastId });
        } catch (e) {
          console.error("Failed to fetch match metadata:", e);
          setMatches([data]);
          toast.success("Match found (metadata failed)!", { id: toastId });
        }
      } else {
        toast.error("No high-score matches found yet.", { id: toastId });
      }
    } catch (error: any) {
      console.error("Matching failed:", error);
      toast.error(`Matching failed: ${error.message || "Is the Agent running?"}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const stakeAndMessage = async (match: any) => {
    setLoading(true);
    try {
      const recipient = ethers.getAddress(match.matchAddress);
      
      // If already staked/connected, just go to chat
      const lowerChatKeys = Object.keys(chatMessages).map(k => k.toLowerCase());
      if (lowerChatKeys.includes(recipient.toLowerCase())) {
        setActiveChat(recipient);
        setStep('chat');
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      const rUSD = new ethers.Contract(RUSD_CONTRACT_ADDRESS, ERC20_ABI, signer);
      
      // Check balance first
      const balance = await rUSD.balanceOf(address);
      const requiredStake = ethers.parseEther("1");
      
      if (balance < requiredStake) {
        throw new Error("Insufficient rUSD balance. Use the 'Get rUSD' faucet in your profile.");
      }

      // Optimization: Check allowance before approving
      const currentAllowance = await rUSD.allowance(address, MESSAGING_CONTRACT_ADDRESS);
      if (currentAllowance < requiredStake) {
        const approveTx = await rUSD.approve(MESSAGING_CONTRACT_ADDRESS, ethers.MaxUint256);
        toast("Approving rUSD usage...");
        await approveTx.wait();
      }

      const messaging = new ethers.Contract(MESSAGING_CONTRACT_ADDRESS, MESSAGING_ABI, signer);
      const tx = await messaging.stakeForMessage(
        match.matchAddress,
        match.score,
        match.signature
      );
      setTxHash(tx.hash);
      await tx.wait();

      setActiveChat(recipient);
      if (!chatMessages[recipient]) {
        setChatMessages(prev => ({
          ...prev,
          [recipient]: []
        }));
      }

      toast.success("Message Staked! You can now chat.");
      setStep('chat');

      // Send an automated greeting to initiate XMTP session
      if (xmtpClient) {
        try {
          const inboxId = await resolveInboxId(recipient);
          if (inboxId) {
            const conversation = await xmtpClient.conversations.createDm(inboxId);
            try {
              await conversation.sync(); 
            } catch (syncErr) {
              console.warn("Auto-greeting sync warning (non-fatal):", syncErr);
            }
            const encoded = await encodeText("hi, I just staked a match credit to connect with you! 👋");
            await conversation.send(encoded);
          }
        } catch (e) {
          if (isXmtpSoftSuccess(e)) {
            console.log("✅ Auto-greeting synced (soft-success)");
          } else {
            console.warn("Failed to send auto-greeting", e);
          }
        }
      }
    } catch (error: any) {
      console.error("Staking failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const claimStake = async () => {
    if (!activeChat || !address) return;
    const toastId = toast.loading("Claiming stake...");
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const messaging = new ethers.Contract(MESSAGING_CONTRACT_ADDRESS, MESSAGING_ABI, signer);
      
      const tx = await messaging.claimStake(activeChat);
      setTxHash(tx.hash);
      await tx.wait();
      
      toast.success("Stake claimed successfully!", { id: toastId });
      setHasActiveStake(false);
    } catch (error: any) {
      console.error("Claim stake failed:", error);
      toast.error(`Claim failed: ${error.message || "Unknown error"}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const burnForReveal = async (recipient: string) => {
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      const rUSD = new ethers.Contract(RUSD_CONTRACT_ADDRESS, ERC20_ABI, signer);
      const requiredReveal = ethers.parseEther("5");
      
      const currentAllowance = await rUSD.allowance(address, MESSAGING_CONTRACT_ADDRESS);
      if (currentAllowance < requiredReveal) {
        const approveTx = await rUSD.approve(MESSAGING_CONTRACT_ADDRESS, ethers.MaxUint256);
        toast("Approving rUSD usage...");
        await approveTx.wait();
      }

      const messaging = new ethers.Contract(MESSAGING_CONTRACT_ADDRESS, MESSAGING_ABI, signer);
      const tx = await messaging.burnForReveal(recipient);
      setTxHash(tx.hash);
      await tx.wait();

      setRevealedUsers(prev => new Set(prev).add(recipient));
      toast.success("High Intent Reveal Purchased!");
    } catch (error: any) {
      console.error("Reveal failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };


  const proposeDate = async (partner: string) => {
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
            const rUSD = new ethers.Contract(RUSD_CONTRACT_ADDRESS, ERC20_ABI, signer);
      const requiredDateStake = ethers.parseEther("10");

      const currentAllowance = await rUSD.allowance(address, ESCROW_CONTRACT_ADDRESS);
      if (currentAllowance < requiredDateStake) {
        const approveTx = await rUSD.approve(ESCROW_CONTRACT_ADDRESS, ethers.MaxUint256);
        toast("Approving rUSD usage...");
        await approveTx.wait();
      }

      const escrow = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.proposeDate(partner);
      setTxHash(tx.hash);
      await tx.wait();

      toast.success("Date Proposed & Stake Locked!");
      checkDateStatus(partner);
    } catch (error: any) {
      console.error("Date proposal failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkDateStatus = async (partner: string) => {
    if (!address) return;
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const escrow = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, provider);
      
      const u1 = address.toLowerCase() < partner.toLowerCase() ? address : partner;
      const u2 = address.toLowerCase() < partner.toLowerCase() ? partner : address;
      const dateId = ethers.keccak256(ethers.solidityPacked(["address", "address"], [u1, u2]));
      
      const data = await escrow.dates(dateId);
      setDateEscrowStatus({
        id: dateId,
        userA: data[0],
        userB: data[1],
        startTime: Number(data[2]),
        amountA: data[3],
        amountB: data[4],
        proofA: data[5],
        proofB: data[6],
        status: Number(data[7])
      });
    } catch (e) {
      console.error("Failed to check date status:", e);
    }
  };

  const acceptDate = async () => {
    if (!address || !dateEscrowStatus) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const rUSD = new ethers.Contract(RUSD_CONTRACT_ADDRESS, ERC20_ABI, signer);
      const approveTx = await rUSD.approve(ESCROW_CONTRACT_ADDRESS, ethers.parseEther("10"));
      await approveTx.wait();

      const escrow = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.acceptDate(dateEscrowStatus.userA);
      setTxHash(tx.hash);
      await tx.wait();

      toast.success("Date Accepted!");
      checkDateStatus(dateEscrowStatus.userA);
    } catch (error: any) {
      console.error("Accept date failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitDateProof = async (signature: string) => {
    if (!activeChat || !dateEscrowStatus) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const escrow = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, signer);
      
      const tx = await escrow.submitProof(activeChat, signature);
      setTxHash(tx.hash);
      await tx.wait();

      toast.success("Meeting Proof Submitted!");
      checkDateStatus(activeChat);
    } catch (error: any) {
      console.error("Submit proof failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !activeChat) return;
    
    const messageText = chatInput;
    
    // Optimistic Update
    setChatMessages(prev => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), { text: messageText, sent: true }]
    }));
    
    setChatInput('');
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto';
    }

    // Send via XMTP if available
    if (xmtpClient) {
      console.log("Preparing to send XMTP V3 message to:", activeChat);
      try {
        const inboxId = await resolveInboxId(activeChat);
        if (!inboxId) throw new Error("Could not resolve recipient identity");
        console.log("🎯 Targeting Recipient Inbox ID:", inboxId);
        
        const conversation = await xmtpClient.conversations.createDm(inboxId);
        try {
          await conversation.sync(); 
        } catch (syncErr) {
          if (isXmtpSoftSuccess(syncErr)) {
            console.log("Message sync report (soft-success)");
          } else {
            console.warn("Message sync warning (non-fatal):", syncErr);
          }
        }
        const encoded = await encodeText(messageText);
        await conversation.send(encoded);
        console.log("✅ Message sent via XMTP V3 (MLS)");
      } catch (error) {
        if (isXmtpSoftSuccess(error)) {
          console.log("✅ Message sent via XMTP V3 (soft-success)");
        } else {
          console.error("❌ Failed to send message via XMTP V3:", error);
          toast.error("Real-time delivery failed");
        }
      }
    }
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHAT_CHARS) {
      setChatInput(value);
      
      // Auto-resize
      if (chatTextareaRef.current) {
        chatTextareaRef.current.style.height = 'auto';
        chatTextareaRef.current.style.height = `${chatTextareaRef.current.scrollHeight}px`;
      }
    }
  };

  const isLanding = step === 'connect';
  const isProfileComplete = !!(profile.name && profile.bio && profile.avatar);

      const hasChanges = !userCID || (
    profile.name !== initialProfile?.name || 
    profile.bio !== initialProfile?.bio ||
    !!pendingAvatarBlob
  );

  return (
    <div className="App">
      {(loading || isConnecting) && (
        <Loading message={isConnecting ? "Connecting Wallet..." : "Processing Transaction..."} />
      )}
      <Toaster 
        position="bottom-center"
        containerStyle={{
          bottom: 80, // Offset to stay above the mobile bottom navbar
        }}
        toastOptions={{
          className: 'glass-toast',
          style: {
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
          },
          success: {
            iconTheme: {
              primary: '#00ffa3',
              secondary: '#fff',
            },
          },
        }}
      />
      {/* Network Warning Banner */}
      {isWrongNetwork && (
        <div style={{ 
          background: 'rgba(204, 0, 0, 0.9)', 
          color: 'white', 
          padding: '0.8rem 1rem', 
          textAlign: 'center', 
          position: 'fixed', 
          top: 0, left: 0, right: 0, 
          zIndex: 9999, 
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontWeight: 'bold' }}>⚠️ Wrong Network Detected</span>
          <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>Connect to Paseo Asset Hub to interact with the blockchain.</span>
          <button 
            onClick={switchNetwork}
            className="secondary-btn"
            style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            Switch to Paseo
          </button>
        </div>
      )}

      {/* Animated Background Orbs */}
      <div className="orb-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Navbar - hidden on landing */}
      {!isLanding && <Navbar address={address} step={step} setStep={setStep} />}

      {/* ===== LANDING / HERO ===== */}
      {step === 'connect' && (
        <section className="hero">
          <img src="/token42.svg" alt="Token42" className="hero-logo" />
          <h1 className="hero-title">Token42</h1>
          <p className="hero-subtitle">
            Verifiable Identity. AI Matching. Staked Connections — built on Polkadot.
          </p>
          <button className="hero-cta" onClick={connectWallet}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
            Connect Wallet
          </button>
          <div className="hero-features">
            <div className="hero-feature">
              <div className="hero-feature-icon">🛡️</div>
              <span className="hero-feature-text">Soulbound Identity</span>
            </div>
            <div className="hero-feature">
              <div className="hero-feature-icon">🧠</div>
              <span className="hero-feature-text">AI Personality Match</span>
            </div>
            <div className="hero-feature">
              <div className="hero-feature-icon">💎</div>
              <span className="hero-feature-text">Staked Messaging</span>
            </div>
          </div>
        </section>
      )}

      {/* ===== PROFILE CREATION ===== */}
      {step === 'profile' && (
        <main className="main">
          <div className="page-brand mobile-only">
            <img src="/token42.svg" alt="Token42" />
            <span className="logo-text">Token42</span>
          </div>
          <div className="dashboard-grid animate-in">
            <GlassCard>

              <div className="card-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h2 style={{ margin: 0 }}>Profile</h2>
                  <StatusBadge status="verified" label="Verified" />
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Identity verified via People Chain
                </p>
              </div>
              
              <div className="profile-stats" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                <div className="stat-item">
                  <span className="stat-value" style={{ display: 'block', fontSize: '1.2rem', fontWeight: 'bold' }}>{matches.length}</span>
                  <span className="stat-label" style={{ fontSize: '0.8rem', opacity: 0.7 }}>Matches</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value" style={{ display: 'block', fontSize: '1.2rem', fontWeight: 'bold' }}>{Object.keys(chatMessages).length}</span>
                  <span className="stat-label" style={{ fontSize: '0.8rem', opacity: 0.7 }}>Chats</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value" style={{ display: 'block', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{parseFloat(rusdBalance).toFixed(2)}</span>
                  <span className="stat-label" style={{ fontSize: '0.8rem', opacity: 0.7 }}>rUSD</span>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button 
                    className="text-btn" 
                    onClick={getFaucetrUSD} 
                    disabled={loading}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', border: '1px solid var(--accent)', borderRadius: '4px' }}
                  >
                    {loading ? "..." : "🪙 Faucet"}
                  </button>
                  <button 
                    className="text-btn" 
                    onClick={revokeXmtpInstallations} 
                    style={{ fontSize: '0.65rem', opacity: 0.5, border: 'none', background: 'transparent' }}
                  >
                    Rescue XMTP
                  </button>
                  <button 
                    className="text-btn" 
                    onClick={clearXmtpOpfs} 
                    style={{ fontSize: '0.65rem', opacity: 0.5, border: 'none', background: 'transparent', color: 'var(--error, #ff4444)' }}
                  >
                    Clear XMTP DB
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Profile Photo</label>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {localAvatarPreview || profile.avatar ? (
                    <img 
                      src={localAvatarPreview || cachedAvatarUrls[profile.avatar!] || `https://gateway.pinata.cloud/ipfs/${profile.avatar}`} 
                      className="avatar-upload-preview" 
                      alt="Avatar Preview" 
                      onClick={() => document.getElementById('avatar-input')?.click()}
                    />
                  ) : (
                    <div className="avatar-placeholder" onClick={() => document.getElementById('avatar-input')?.click()}>
                      <span style={{ fontSize: '2rem' }}>📸</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    id="avatar-input" 
                    hidden 
                    accept="image/*" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.readAsDataURL(file);
                      reader.onload = () => {
                        setImageToCrop(reader.result as string);
                      };
                    }}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tap to {profile.avatar || localAvatarPreview ? 'change' : 'upload'}</p>
                </div>
              </div>

              {imageToCrop && (
                <div className="modal-overlay">
                  <GlassCard className="modal-content" style={{ height: '550px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Crop Profile Photo</h3>
                    <div style={{ flex: 1, position: 'relative', width: '100%', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
                      <Cropper
                        image={imageToCrop}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                      />
                    </div>
                    <div style={{ padding: '1rem 0' }}>
                      <label className="input-label" style={{ fontSize: '0.8rem' }}>Zoom</label>
                      <input 
                        type="range" 
                        value={zoom} 
                        min={1} 
                        max={3} 
                        step={0.1} 
                        onChange={(e) => setZoom(Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button className="text-btn" onClick={() => setImageToCrop(null)} style={{ flex: 1 }}>Cancel</button>
                      <button className="primary-btn" onClick={handleCropConfirm} style={{ flex: 2 }}>Confirm Crop</button>
                    </div>
                  </GlassCard>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Display Name</label>
                <input 
                  type="text" 
                  className="rich-input" 
                  placeholder="What should we call you?" 
                  value={profile.name}
                  onChange={(e) => setProfile({...profile, name: e.target.value})}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Bio</label>
                <textarea 
                  placeholder="Share a bit about yourself, your passions, what you're looking for..." 
                  className="rich-input" 
                  style={{ minHeight: '140px', resize: 'vertical' }}
                  value={profile.bio}
                  onChange={(e) => setProfile({...profile, bio: e.target.value})}
                  disabled={loading}
                  maxLength={500}
                />
                <div className="char-count">{profile.bio.length}/500</div>
              </div>

              <button 
                onClick={createProfile} 
                className="primary-btn"
                disabled={loading || !profile.bio || (userCID ? !hasChanges : false)}
              >
                {loading ? (
                  <span className="loading-pulse">{userCID ? "Updating Profile..." : "Minting Soulbound Token..."}</span>
                ) : (
                  userCID ? (hasChanges ? "Update Profile →" : "No Changes Detected") : "Mint Soulbound Profile →"
                )}
              </button>

            </GlassCard>

            <aside>
              <GlassCard className="sidebar-card">
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>How it works</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { icon: '🔐', title: 'Verify', desc: 'Your Polkadot identity is checked on-chain' },
                    { icon: '🎭', title: 'Mint', desc: 'A non-transferable soulbound token is created' },
                    { icon: '🤖', title: 'Match', desc: 'AI processes your personality vectors privately' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                      <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
              <GlassCard className="sidebar-card">
                <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>Your Wallet</h3>
                <div className="cid-display">{address}</div>
              </GlassCard>
            </aside>
          </div>
        </main>
      )}

      {/* ===== DISCOVERY / MATCHING ===== */}
      {step === 'matching' && (
        <main className="main">
          <div className="page-brand mobile-only">
            <img src="/token42.svg" alt="Token42" />
            <span className="logo-text">Token42</span>
          </div>
          <div className="dashboard-grid animate-in">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.5px' }}>Discovery</h2>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>AI-guided matches based on personality vectors</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {!isProfileComplete && (
                    <button 
                      className="lock-info-btn" 
                      onClick={() => setIsMatchLockModalOpen(true)}
                      title="Profile Incomplete"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </button>
                  )}
                  <button 
                    onClick={findMatches} 
                    className="primary-btn" 
                    style={{ width: 'auto', padding: '0.7rem 1.5rem' }}
                    disabled={loading || !isProfileComplete}
                  >
                    {loading ? <span className="loading-pulse">Scanning...</span> : "Find Matches"}
                  </button>
                </div>
              </div>

              {matches.length === 0 && !loading && (
                <GlassCard>
                  <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <p>Hit <strong>Find Matches</strong> to let the AI analyze compatible profiles near you.</p>
                  </div>
                </GlassCard>
              )}

              {loading && matches.length === 0 && (
                <GlassCard>
                  <div className="empty-state loading-pulse">
                    <div className="empty-state-icon">🧠</div>
                    <p>Deep-Thought AI is analyzing personality vectors...</p>
                  </div>
                </GlassCard>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {matches.map((m, i) => (
                  <GlassCard key={i} className="match-card animate-in">
                    <div className="match-card-body">
                      <div className={`match-avatar ${!revealedUsers.has(m.matchAddress.toLowerCase()) ? 'blurred' : ''}`}>
                        {m.avatar ? (
                          <img src={cachedAvatarUrls[m.avatar] || `https://gateway.pinata.cloud/ipfs/${m.avatar}`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          m.matchAddress ? m.matchAddress.slice(2, 4).toUpperCase() : '??'
                        )}
                      </div>
                      <div className="match-info">
                        <h3>{m.matchAddress.slice(0, 10)}...{m.matchAddress.slice(-6)}</h3>
                        <p>{m.matchBio || "Matching personality profile..."}</p>
                      </div>
                      <div className="match-score-ring">
                        <svg viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--accent)" strokeWidth="3" 
                            strokeDasharray={`${(m.score / 10000) * 97.4} 97.4`}
                            strokeLinecap="round" />
                        </svg>
                        <span className="score-text">{(m.score / 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="match-actions">
                      {chatMessages[m.matchAddress] || Object.keys(chatMessages).some(k => k.toLowerCase() === m.matchAddress.toLowerCase()) ? (
                        <button 
                          onClick={() => {
                            const actualKey = Object.keys(chatMessages).find(k => k.toLowerCase() === m.matchAddress.toLowerCase()) || m.matchAddress;
                            setActiveChat(actualKey);
                            setStep('chat');
                          }} 
                          className="primary-btn connected-btn"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                          Go to Chat
                        </button>
                      ) : (
                        <button onClick={() => stakeAndMessage(m)} className="primary-btn" disabled={loading}>
                          {loading ? "Processing..." : "Stake & Connect"}
                        </button>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>

            <aside>
              <GlassCard className="sidebar-card">
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Your Identity</h3>
                <div className="identity-row">
                  <div className="identity-avatar">
                    {(localAvatarPreview || profile.avatar) && (
                      <img 
                        src={localAvatarPreview || cachedAvatarUrls[profile.avatar!] || `https://gateway.pinata.cloud/ipfs/${profile.avatar}`} 
                        alt="" 
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                    )}
                  </div>
                  <div>
                    <div className="identity-name">{profile.name || 'Anonymous'}</div>
                    <StatusBadge status="verified" label="Human" />
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{profile.bio}</p>
              </GlassCard>
              <GlassCard className="sidebar-card">
                <div className="input-label" style={{ marginBottom: '0.5rem' }}>Soulbound CID</div>
                <div className="cid-display">{userCID}</div>
              </GlassCard>
            </aside>
          </div>
        </main>
      )}

      {/* ===== CHAT ===== */}
      {step === 'chat' && (
        <main className="main chat-page">
          <div className="page-brand mobile-only">
            <img src="/token42.svg" alt="Token42" />
            <span className="logo-text">Token42</span>
          </div>
          
          <div className="chat-layout animate-in">
            {/* Chat Sidebar / Mobile Dropdown */}
            <GlassCard className={`chat-sidebar ${isMobileSessionOpen ? 'mobile-open' : ''}`}>
              <div 
                className="sidebar-header" 
                onClick={() => setIsMobileSessionOpen(!isMobileSessionOpen)}
              >
                <h3>Sessions</h3>
                <div className="mobile-session-selector">
                  {activeChat ? (
                    <div className="active-session-summary">
                      <div className={`session-avatar tiny ${!revealedUsers.has(activeChat.toLowerCase()) ? 'blurred' : ''}`}>
                        {activeChat.slice(2, 4).toUpperCase()}
                      </div>
                      <span>{activeChat.slice(0, 6)}...{activeChat.slice(-4)}</span>
                    </div>
                  ) : <span>Select Chat</span>}
                  <svg className={`dropdown-icon ${isMobileSessionOpen ? 'open' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
              
              <div className="session-list">
                {Object.keys(chatMessages).map((addr) => (
                  <div 
                    key={addr} 
                    className={`session-item ${activeChat === addr ? 'active' : ''}`}
                    onClick={() => {
                      setActiveChat(addr);
                      setIsMobileSessionOpen(false);
                    }}
                  >
                    <div className={`session-avatar ${!revealedUsers.has(addr.toLowerCase()) ? 'blurred' : ''}`}>
                      {matches.find(m => m.matchAddress.toLowerCase() === addr.toLowerCase())?.avatar ? (
                        <img 
                          src={cachedAvatarUrls[matches.find(m => m.matchAddress.toLowerCase() === addr.toLowerCase())?.avatar!] || `https://gateway.pinata.cloud/ipfs/${matches.find(m => m.matchAddress.toLowerCase() === addr.toLowerCase())?.avatar}`} 
                          alt="" 
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                        />
                      ) : (
                        addr.slice(2, 4).toUpperCase()
                      )}
                    </div>
                    <div className="session-info">
                      <div className="session-address">{addr.slice(0, 6)}...{addr.slice(-4)}</div>
                      <div className="session-last-msg">
                        {chatMessages[addr].length > 0 
                          ? chatMessages[addr][chatMessages[addr].length - 1].text 
                          : "No messages yet"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Chat Main */}
            <div className="chat-main-container">
              {activeChat ? (
                <>
                  <div className="chat-external-header">
                    <div className="chat-header-info">
                      <div className="chat-recipient-address">
                        {activeChat.slice(0, 8)}...{activeChat.slice(-6)}
                      </div>
                      <p className="chat-verification-msg">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', color: 'var(--accent)' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        End-to-end encrypted • Protected Session
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button 
                        className="text-btn bio-toggle-btn" 
                        onClick={() => setShowRecipientBio(!showRecipientBio)}
                        style={{ color: showRecipientBio ? 'var(--accent)' : 'var(--text-muted)' }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="bio-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        <span className="bio-btn-text">{showRecipientBio ? 'Hide Bio' : 'View Bio'}</span>
                      </button>
                      <button 
                        className="text-btn" 
                        onClick={() => {
                          checkDateStatus(activeChat);
                          setIsPoRLModalOpen(true);
                        }}
                        style={{ color: 'var(--accent)', marginRight: '8px' }}
                      >
                        🤝 Verify Date
                      </button>
                      <StatusBadge status="verified" label="Staked" />
                    </div>
                  </div>

                  {showRecipientBio && (
                    <div className="recipient-bio-overlay animate-in">
                      <p>{chatMessages[activeChat]?.[0]?.text ? "Bio extracted from AI Match" : "Bio shared via protocol"}</p>
                      <div className="bio-content">
                        {/* In a real app, we'd fetch the recipient's bio from IPFS using their CID. 
                            For now, we'll show a placeholder or mock info. */}
                        Passionate about decentralized systems and AI. Looking for someone to build the future with.
                      </div>
                    </div>
                  )}

                  <GlassCard className="chat-container" style={{ position: 'relative' }}>
                    <div className="chat-messages">
                    {(chatMessages[activeChat] || []).map((msg, i) => (
                      <div key={i} className={`chat-bubble ${msg.sent ? 'sent' : 'received'}`}>
                        {msg.text}
                      </div>
                    ))}
                    {/* Instant Reveal Button for Staked High Intent */}
                    {!revealedUsers.has(activeChat.toLowerCase()) && (
                      <div className="reveal-overlay-btn">
                        <button 
                          className="primary-btn" 
                          style={{ width: 'auto', padding: '0.6rem 1.2rem', fontSize: '0.8rem' }}
                          onClick={() => burnForReveal(activeChat)}
                        >
                          🔥 Burn 5 rUSD to Reveal Profile
                        </button>
                      </div>
                    )}
                    {chatMessages[activeChat]?.length === 0 && !hasActiveStake && (
                      <div className="empty-chat">
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    )}
                    
                    {/* Centered Claim Reward Overlay */}
                    {hasActiveStake && (
                      <div className="chat-lock-overlay animate-in">
                        <div className="chat-lock-content">
                          <div className="lock-icon-large">🎁</div>
                          <h3>New Connection Reward!</h3>
                          <p>A user has staked tokens to message you. Claim the tokens to unlock this chat session.</p>
                          <button 
                            className="primary-btn" 
                            onClick={claimStake}
                            style={{ width: 'auto', padding: '0.8rem 2rem', marginTop: '1rem', background: 'var(--accent)', color: '#000' }}
                            disabled={loading}
                          >
                            {loading ? "Processing..." : "Claim & Unlock Chat →"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={`chat-input-bar ${hasActiveStake ? 'locked' : ''}`}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <textarea 
                        ref={chatTextareaRef}
                        className="chat-input" 
                        placeholder={hasActiveStake ? "Claim reward to unlock chat..." : "Type a message..."} 
                        value={chatInput} 
                        onChange={handleChatInputChange}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !hasActiveStake) {
                            e.preventDefault();
                            sendChat();
                          }
                        }}
                        rows={1}
                        disabled={hasActiveStake}
                      />
                      {!hasActiveStake && (
                        <div className="chat-char-count">
                          {chatInput.length}/{MAX_CHAT_CHARS}
                        </div>
                      )}
                    </div>
                    <button 
                      className="chat-send-btn" 
                      onClick={sendChat}
                      disabled={hasActiveStake || !chatInput.trim()}
                    >
                      Send
                    </button>
                  </div>
                </GlassCard>
                </>
              ) : (
                <GlassCard className="chat-container">
                  <div className="no-chat-selected">
                    <div className="empty-state-icon">💬</div>
                    <p>Select a session to start chatting</p>
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        </main>
      )}

      {/* Footer - hidden on landing */}
      {!isLanding && (
        <footer className="app-footer">
          <p>Built on <a href="https://polkadot.network" target="_blank" rel="noopener">Polkadot Asset Hub</a> (Revive EVM) & Phala Network</p>
        </footer>
      )}

      {isPoRLModalOpen && activeChat && (
        <PoRLModal 
          address={address!}
          partner={activeChat}
          status={dateEscrowStatus}
          onClose={() => setIsPoRLModalOpen(false)}
          onAcceptDate={acceptDate}
          onSubmitProof={submitDateProof}
        />
      )}
      {isMatchLockModalOpen && (
        <div className="modal-overlay">
          <GlassCard className="modal-content animate-in" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              background: 'rgba(255, 51, 102, 0.1)', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: 'var(--primary)'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 style={{ marginBottom: '0.5rem' }}>Discovery Locked</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.6 }}>
              Our AI Matchmaker needs to know you first! Complete the following in the <strong>Profile</strong> tab to unlock discovery:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: profile.name ? 'var(--accent)' : 'var(--text-muted)' }}>{profile.name ? '✅' : '🔴'}</span>
                <span style={{ opacity: profile.name ? 1 : 0.6 }}>Display Name</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: profile.bio ? 'var(--accent)' : 'var(--text-muted)' }}>{profile.bio ? '✅' : '🔴'}</span>
                <span style={{ opacity: profile.bio ? 1 : 0.6 }}>Bio Description</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: profile.avatar ? 'var(--accent)' : 'var(--text-muted)' }}>{profile.avatar ? '✅' : '🔴'}</span>
                <span style={{ opacity: profile.avatar ? 1 : 0.6 }}>Profile Photo</span>
              </div>
            </div>
            <button 
              className="primary-btn" 
              onClick={() => {
                setIsMatchLockModalOpen(false);
                setStep('profile');
              }}
            >
              Go to Profile →
            </button>
            <button 
              className="text-btn" 
              style={{ marginTop: '1rem', color: 'var(--text-muted)' }}
              onClick={() => setIsMatchLockModalOpen(false)}
            >
              Close
            </button>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

export default App;
