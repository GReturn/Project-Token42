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
import ReportModal from './components/ReportModal';
import { compressImage, getCroppedImg } from './utils/images';
import Cropper from 'react-easy-crop';
import { Heart, Sparkles, Shield, Camera, MessageCircle, Lock, Gift, User, LogOut, CheckCircle, Search, Flame } from 'lucide-react';

// Contract Addresses (Paseo Asset Hub - PolkaVM)
const PROFILE_CONTRACT_ADDRESS = import.meta.env.VITE_PROFILE_CONTRACT_ADDRESS || "0x9B9f7569A535Cd2B66EC9B2F5509F5e688Ba92B5";
const MESSAGING_CONTRACT_ADDRESS = import.meta.env.VITE_MESSAGING_CONTRACT_ADDRESS || "0x8B8d13a7f678FA8f6793290Ee9e46302Be427453";
const ESCROW_CONTRACT_ADDRESS = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS || "0xb6B64176CC8a8350AB84D466CD4bf111C3A6E7a5";
const RUSD_CONTRACT_ADDRESS = import.meta.env.VITE_RUSD_CONTRACT_ADDRESS || "0xFE4eae5d84412B70b1f04b3F78351a654D28Da25";

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
  "function cancelDate(address partner) public",
  "function resolveExpired(address partner) public",
  "function dates(bytes32 dateId) public view returns (address userA, address userB, uint256 startTime, uint256 amountA, uint256 amountB, bool proofA, bool proofB, bool cancelA, bool cancelB, uint8 status)"
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
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalStatus, setReportModalStatus] = useState<string>('Safe');
  const [isMatchLockModalOpen, setIsMatchLockModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Record<string, { text: string; sent: boolean }[]>>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [initialProfile, setInitialProfile] = useState<UserProfile | null>(null);
  const [xmtpClient, setXmtpClient] = useState<Client | null>(null);
  const [agentInboxId, setAgentInboxId] = useState<string | null>(null);
  const [rusdBalance, setRusdBalance] = useState<string>("0");
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [isXmtpLoading, setIsXmtpLoading] = useState(false);

  const checkBlockStatus = async () => {
    if (!address) return;
    try {
      const response = await fetch(`http://localhost:3001/blocks?address=${address}`);
      const data = await response.json();
      setBlockedUsers(data.blockedUsers || []);
    } catch (e) {
      console.error("Failed to fetch blocks:", e);
    }
  };

  useEffect(() => {
    if (address) {
      checkBlockStatus();
      const timer = setInterval(checkBlockStatus, 5000);
      return () => clearInterval(timer);
    }
  }, [address]);
  const [showRecipientBio, setShowRecipientBio] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [hasActiveStake, setHasActiveStake] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [pendingAvatarBlob, setPendingAvatarBlob] = useState<Blob | null>(null);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
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

  // Auto-load Agent Info on boot for 3-Way moderated Group Chat
  useEffect(() => {
    const fetchAgentInfo = async () => {
      try {
        const response = await fetch('http://localhost:3001/info');
        const data = await response.json();
        if (data.agentInboxId) {
          console.log("🤖 Auto-loaded Agent Inbox ID for Moderation:", data.agentInboxId);
          setAgentInboxId(data.agentInboxId);
        }
      } catch (e) {
        console.warn("⚠️ Failed to auto-load Agent info (Normal if agent is offline):", e);
      }
    };
    fetchAgentInfo();
  }, []);

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
            if (await profileContract.hasProfile(addr)) {
              const cid = await profileContract.getProfileCID(addr);
              if (cid) {
                const metadata = await fetchFromIPFS(cid); // Uses JSON cache
                if (metadata.avatar) {
                  const url = await fetchImageFromIPFS(metadata.avatar); // Uses Image cache
                  setCachedAvatarUrls(prev => ({ ...prev, [metadata.avatar!]: url }));
                }
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
                if (await profileContract.hasProfile(checksummedPartner)) {
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
                }
              } catch (e) {
                console.warn("Match metadata restoration failed for", partner);
              }
            }
          }
        }
        if (changed) setChatMessages(newChats);

        // --- ADD REVEALPURCHASED RECOVERY ---
        try {
          const revealFilter = messaging.filters.RevealPurchased();
          const revealEvents = await messaging.queryFilter(revealFilter, -5000);

          const relevantReveals = revealEvents.filter((event: any) => {
            if (!event.args) return false;
            return event.args.sender.toLowerCase() === address.toLowerCase();
          });

          if (relevantReveals.length > 0) {
            console.log(`Found ${relevantReveals.length} relevant on-chain reveals.`);
            setRevealedUsers(prev => {
              const updated = new Set(prev);
              relevantReveals.forEach((event: any) => {
                updated.add(event.args.recipient.toLowerCase());
              });
              return updated;
            });
          }
        } catch (err) {
          console.error("Failed to recover reveals:", err);
        }
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
          chainId: '0x190F1B41', // 420420417
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
      } else {
        if (step === 'connect') setStep('profile');
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
    }
  };

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
      const checksummedAddress = await signer.getAddress();

      // Wrap Ethers signer for XMTP V3
      const xmtpSigner = {
        type: 'EOA' as const,
        getIdentifier: async () => ({
          identifier: checksummedAddress, // Use standard checksummed address (with 0x)
          identifierKind: 0 as any
        }),
        signMessage: async (message: string) => {
          const sig = await signer.signMessage(message);
          return ethers.getBytes(sig);
        }
      };

      // 1. STATIC AUTO-RECOVERY CHECK (BEFORE Client.create loads file locks)
      let shouldForceRegister = false;
      try {
        const backend = await createBackend({ env: "dev" });
        const inboxId = await getInboxIdForIdentifier(backend, {
          identifier: checksummedAddress,
          identifierKind: 0 as any
        });

        if (inboxId) {
          const states = await Client.fetchInboxStates([inboxId], backend);
          const inboxState = states[0];
          const count = inboxState?.installations?.length || 0;
          console.log(`🌐 Static network lookup for inbox ${inboxId.substring(0, 8)}: installations=${count}`);

          const forceRecover = localStorage.getItem('xmtp_force_recover') === 'true';

          if (count === 0 || forceRecover) {
            console.warn(`⚠️ Clearing local DB BEFORE creation. Reason: ${count === 0 ? "Count 0" : "Force Recover Flag"}`);
            localStorage.removeItem('xmtp_force_recover');
            try {
              const root = await navigator.storage.getDirectory();
              for await (const [name] of (root as any).entries()) {
                await root.removeEntry(name, { recursive: true });
                console.log(`  Deleted OPFS entry: ${name}`);
              }
            } catch (opfsErr) {
              console.warn("Static OPFS cleanup warning:", opfsErr);
            }
            shouldForceRegister = true;
          }
        }
      } catch (e) {
        console.warn("Static inbox lookup failed (non-fatal):", e);
      }

      // 2. CREATE CLIENT
      const client = await Client.create(xmtpSigner as any, {
        env: "dev",
        dbPath: `token42-${address.toLowerCase()}.db`
      } as any);

      if (shouldForceRegister) {
        console.log("🔄 Triggering explicit registration on fresh client setup...");
        try {
          if (typeof client.register === 'function') {
            await client.register();
            console.log("✅ Registration published on fresh client.");
            toast.success("Identity registered with network node!");
          }
        } catch (regErr) {
          console.error("Post-recovery registration failed:", regErr);
        }
      }

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
      console.log(`Detected ${installationIds.length} installations:`, installationIds.map(i => ethers.hexlify(i)));

      // Static revoke (requires signer + inboxId + array of IDs)
      console.log("Sending revocation transaction to network...");
      await Client.revokeInstallations(xmtpSigner as any, inboxId, installationIds, backend);
      console.log("Revocation successful.");

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
            if (String(e).includes("InboxValidationFailed") || (e as any)?.message?.includes("InboxValidationFailed")) {
              console.warn("🚨 InboxValidationFailed detected (revoked key)! Triggering OPFS clear and reboot...");
              localStorage.setItem("xmtp_force_recover", "true");
              window.location.reload();
            }
          }
        }, 15000);

        // Helper to resolve sender address from a group topic
        const resolveSender = async (groupOrTopic: any) => {
          const topic = typeof groupOrTopic === 'string' ? groupOrTopic : groupOrTopic.topic;
          if (topicToAddress.current[topic]) return topicToAddress.current[topic];

          try {
            const group = typeof groupOrTopic === 'string'
              ? (await xmtpClient.conversations.list()).find((g: any) => g.id === topic || g.topic === topic)
              : groupOrTopic;

            if (group) {
              try {
                await group.sync();
              } catch (syncErr) {
                console.warn(`Resolution sync failed for ${topic.substring(0, 8)}, trying members anyway...`);
              }
              const members = await group.members();
              console.log(`Group ${topic.substring(0, 8)} members:`, members.map((m: any) => m.inboxId));
              const otherMember = members.find((m: any) =>
                m.inboxId !== xmtpClient.inboxId &&
                (!agentInboxId || m.inboxId !== agentInboxId)
              );
              if (otherMember) {
                console.log("🔍 otherMember full description:", otherMember);
                const identifiers = (otherMember as any).accountIdentifiers || (otherMember as any).accountAddresses || [];

                if (identifiers.length > 0) {
                  const identifierObj = identifiers[0];
                  let addr = typeof identifierObj === 'object' && identifierObj.identifier
                    ? identifierObj.identifier
                    : identifierObj;

                  if (typeof addr === 'string') {
                    if (addr.startsWith('ethereum:')) {
                      addr = addr.replace('ethereum:', '');
                    }
                    try {
                      addr = ethers.getAddress(addr); // checksum standard
                      topicToAddress.current[topic] = addr;
                      return addr;
                    } catch (e) {
                      console.warn("⚠️ Failed to parse address from identifier:", addr, e);
                    }
                  }
                } else {
                  console.warn("⚠️ otherMember found but has no accountIdentifiers", otherMember);
                }
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

            const promises = existingConvs.map(async (conv) => {
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

                    // Fetch historical messages from group
                    try {
                      const messages = await conv.messages();
                      // Decode and format messages
                      const formatted = messages.map((m: any) => {
                        let text = "";
                        const content = m.content;

                        // Skip Administrative Group Lifecycle/Membership Messages
                        if (content && typeof content === 'object' && (content as any).initiatedByInboxId) {
                          return null;
                        }

                        if (typeof content === 'string') text = content;
                        else if (content instanceof Uint8Array) text = new TextDecoder().decode(content);
                        else if (content && typeof content === 'object') text = (content as any).text || (content as any).body || JSON.stringify(content);

                        return {
                          text,
                          sent: m.senderInboxId === xmtpClient.inboxId, // true if user sent it
                          timestamp: m.sentAt ? m.sentAt : undefined
                        };
                      }).filter((m: any) => m && m.text).reverse();

                      if (formatted.length > 0) {
                        console.log(`Loaded ${formatted.length} historical messages for ${partnerAddress}`);
                        setChatMessages(prev => {
                          const existing = prev[partnerAddress] || [];
                          const newMessages = (formatted as any[]).filter((m: any) => m && !existing.some((e: any) => e.text === m.text));
                          const combined = [...existing, ...newMessages];

                          // Explicit sort by timestamp (Ascending order)
                          combined.sort((a: any, b: any) => {
                            const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                            const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                            return tA - tB;
                          });

                          return {
                            ...prev,
                            [partnerAddress]: combined
                          };
                        });
                      }
                    } catch (msgError) {
                      console.warn(`Failed to load historical messages for ${partnerAddress}:`, msgError);
                    }
                  } catch (syncErr) {
                    console.warn(`Sync failed for group ${conv.id.substring(0, 8)}, skipping messages for now.`, syncErr);
                  }

                  // Trigger profile resolution for the chat list
                  try {
                    const provider = new ethers.BrowserProvider((window as any).ethereum);
                    const profileContract = new ethers.Contract(PROFILE_CONTRACT_ADDRESS, PROFILE_ABI, provider);
                    if (await profileContract.hasProfile(partnerAddress)) {
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
            });
            await Promise.all(promises);
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
                    if (await profileContract.hasProfile(partnerAddress)) {
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
                    }
                  } catch (e) { console.warn("Failed to resolve profile for new conversation:", partnerAddress); }
                }
              }
            } catch (e) {
              if (isTerminated) break;
              console.warn("Conversation stream died, reconnecting...", e);
              if (String(e).includes("InboxValidationFailed") || (e as any)?.message?.includes("InboxValidationFailed")) {
                console.warn("🚨 InboxValidationFailed detected in stream! Triggering OPFS clear and reboot...");
                localStorage.setItem("xmtp_force_recover", "true");
                window.location.reload();
              }
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
              console.log(`Streamed raw message detected: ${message.id} from ${message.senderInboxId}`);

              // DIAGNOSTIC Diagnostics: see what properties are actually present
              console.log("🔍 Message keys:", Object.keys(message));
              console.log("🔍 Message details:", {
                convoId: (message as any).convoId || (message as any).conversationId || (message as any).groupId,
                group: (message as any).group ? "present" : "missing",
                topic: (message as any).topic ? "present" : "missing"
              });

              if (message.senderInboxId === xmtpClient.inboxId) {
                console.log("Skipping own message");
                continue;
              }

              // Optimization: Expand group list fallback to find Group OR Conversation key
              const groupRef =
                (message as any).group ||
                (message as any).topic ||
                (message as any).groupTopic ||
                (message as any).groupId ||
                (message as any).convoId ||
                (message as any).conversationId;

              if (!groupRef) {
                console.warn("⚠️ Message detected but no group/topic context found. Object dump:", message);
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
                    [senderAddress]: [...existing, {
                      text,
                      sent: false,
                      timestamp: message.sentAt || new Date()
                    }]
                  };
                });
              }
            }
          } catch (e) {
            if (isTerminated) break;
            console.warn("Message stream died, reconnecting...", e);
            if (String(e).includes("InboxValidationFailed") || (e as any)?.message?.includes("InboxValidationFailed")) {
              console.warn("🚨 InboxValidationFailed detected in message stream! Triggering OPFS clear and reboot...");
              localStorage.setItem("xmtp_force_recover", "true");
              window.location.reload();
            }
            await new Promise(r => setTimeout(r, 3000));
          }
        }
      } catch (err) {
        if (!isTerminated) {
          console.error("XMTP Streaming error:", err);
          if (String(err).includes("InboxValidationFailed") || (err as any)?.message?.includes("InboxValidationFailed")) {
            localStorage.setItem("xmtp_force_recover", "true");
            window.location.reload();
          }
        }
      }
    };

    startStreaming();

    return () => {
      isTerminated = true;
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [xmtpClient]);

  // Check stake status and date status when active chat changes
  useEffect(() => {
    if (activeChat && address) {
      checkStakeStatus(activeChat);
      checkDateStatus(activeChat); // Initial check
      const interval = setInterval(() => checkDateStatus(activeChat), 12000);
      return () => clearInterval(interval);
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

  const handleReport = async (partner: string) => {
    if (!partner || !address) return;
    const toastId = toast.loading("Submitting report to AI Moderator...");
    try {
      const response = await fetch('http://localhost:3001/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: address,
          recipient: partner,
          chatHistory: chatMessages[partner] || []
        })
      });
      const data = await response.json();

      // Trigger evaluation modal for demonstration
      setReportModalStatus(data.status || "Error");
      setIsReportModalOpen(true);

      if (data.status === "Slashed") {
        toast.success("User reported. AI has verified violation.", { id: toastId, duration: 5000 });

        // Remove from local chat mappings
        setChatMessages(prev => {
          const updated = { ...prev };
          delete updated[partner];
          return updated;
        });

        // Remove from matches discovery list
        setMatches(prev => prev.filter(m => m.matchAddress.toLowerCase() !== partner.toLowerCase()));

        // Close active view
        setActiveChat(null);

      } else if (data.status === "Safe") {
        toast.success("AI evaluated chat: No policy violations found.", { id: toastId });
      } else {
        toast.success("Report submitted for review.", { id: toastId });
      }
    } catch (e) {
      toast.error("Failed to submit report.", { id: toastId });
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
        if (data.agentInboxId) {
          console.log("🤖 Storing Agent Inbox ID for Moderation:", data.agentInboxId);
          setAgentInboxId(data.agentInboxId);
        }
        // Fetch full metadata for the match to get the avatar
        try {
          const matchCid = data.matchCid || potentialMatches.find(m => m.address.toLowerCase() === data.matchAddress.toLowerCase())?.cid;
          const metadata = await fetchFromIPFS(matchCid);
          setMatches([{
            ...data,
            avatar: metadata.avatar,
            matchName: metadata.name,
            matchBio: metadata.bio
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
        (async () => {
          try {
            const inboxId = await resolveInboxId(recipient);
            if (inboxId) {
              const conversation = await xmtpClient.conversations.createGroup([
                inboxId,
                ...(agentInboxId ? [agentInboxId] : [])
              ]);
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
        })();
      }
    } catch (error: any) {
      console.error("Staking failed:", error);
      toast.error(`Error: ${error?.message || "Transaction failed"}`);
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

      setRevealedUsers(prev => new Set(prev).add(recipient.toLowerCase()));
      toast.success("High Intent Reveal Purchased!");
    } catch (error: any) {
      console.error("Reveal failed:", error);
      toast.error(`Error: ${error?.message || "Transaction failed"}`);
    } finally {
      setLoading(false);
    }
  };


  const cancelDate = async (partner: string) => {
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const escrow = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.cancelDate(partner);
      await tx.wait();
      toast.success("Date Cancellation Requested!");
      checkDateStatus(partner);
    } catch (error: any) {
      console.error("Cancel failed:", error);
      toast.error(`Cancel Failed`);
    } finally {
      setLoading(false);
    }
  };

  const resolveExpired = async (partner: string) => {
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const escrow = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.resolveExpired(partner);
      await tx.wait();
      toast.success("Expired Date Settled!");
      checkDateStatus(partner);
    } catch (error: any) {
      console.error("Resolve failed:", error);
      toast.error(`Resolve Failed`);
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
      toast.error(`Error: ${error?.message || "Transaction failed"}`);
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
        cancelA: data[7],
        cancelB: data[8],
        status: Number(data[9])
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
      toast.error(`Error: ${error?.message || "Transaction failed"}`);
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
      toast.error(`Error: ${error?.message || "Transaction failed"}`);
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

        // Force refresh recipient's installation list into local cache from network
        try {
          console.log("Heating installations cache via canMessage...");
          await xmtpClient.canMessage([{
            identifier: activeChat,
            identifierKind: 0 as any
          }]);
        } catch (prefErr) {
          console.warn("Failed to heat installations cache (non-fatal):", prefErr);
        }

        const conversation = await xmtpClient.conversations.createGroup([
          inboxId,
          ...(agentInboxId ? [agentInboxId] : [])
        ]);
        console.log(`📡 DM Conversation created/found: ${conversation.id.substring(0, 8)}`);
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
      } catch (error: any) {
        if (isXmtpSoftSuccess(error)) {
          console.log("✅ Message sent via XMTP V3 (soft-success)");
        } else {
          console.error("❌ Failed to send message via XMTP V3:", error);
          toast.error("Real-time delivery failed");
          if (String(error).includes("InboxValidationFailed") || error?.message?.includes("InboxValidationFailed")) {
            console.warn("🚨 InboxValidationFailed detected! Triggering OPFS clear and reboot...");
            localStorage.setItem("xmtp_force_recover", "true");
            window.location.reload();
          }
        }
      }
    }
  };

  const forceNewRoom = async () => {
    if (!activeChat || !xmtpClient) return;
    const toastId = toast.loading("Creating fresh troubleshooting room...");
    try {
      const inboxId = await resolveInboxId(activeChat);
      if (!inboxId) throw new Error("Could not resolve recipient identity");

      console.log("🧨 Forcing fresh room creation for:", activeChat);

      // Force refresh recipient's installation list into local cache from network
      try {
        console.log("Heating installations cache via canMessage...");
        await xmtpClient.canMessage([{
          identifier: activeChat,
          identifierKind: 0 as any
        }]);
      } catch (prefErr) {
        console.warn("Failed to heat installations cache (non-fatal):", prefErr);
      }

      // createDm creates/finds a 1:1 DM conversation (proper DM stitching)
      const conversation = await xmtpClient.conversations.createDm(inboxId);
      console.log("🆕 New conversation ID:", conversation.id);

      try {
        await conversation.sync();
      } catch (syncErr) {
        if (isXmtpSoftSuccess(syncErr)) {
          console.log("Fresh room sync report (soft-success)");
        } else {
          console.warn("Fresh room sync warning:", syncErr);
        }
      }

      const encoded = await encodeText("🛠️ Troubleshooting: Fresh conversation started.");
      await conversation.send(encoded);

      toast.success("Fresh room created! Send a message to test.", { id: toastId });
    } catch (error: any) {
      if (isXmtpSoftSuccess(error)) {
        console.log("✅ Fresh room created! (soft-success response)");
        toast.success("Fresh room created (soft-success)! Send a message.", { id: toastId });
      } else {
        console.error("Force new room failed:", error);
        toast.error(`Failed to create fresh room: ${error.message}`, { id: toastId });
        if (String(error).includes("InboxValidationFailed") || error?.message?.includes("InboxValidationFailed")) {
          console.warn("🚨 InboxValidationFailed detected (create)! Triggering OPFS clear and reboot...");
          localStorage.setItem("xmtp_force_recover", "true");
          window.location.reload();
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
    <div className="App h-screen overflow-hidden text-brand-light bg-brand-black flex flex-col font-sans">
      {(loading || isConnecting) && (
        <Loading message={isConnecting ? "Connecting Wallet..." : "Processing Transaction..."} />
      )}
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'glass-toast',
          style: {
            background: 'rgba(25, 25, 25, 0.9)',
            backdropFilter: 'blur(12px)',
            color: '#eef0ef',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
          },
          success: {
            iconTheme: {
              primary: '#d12d24',
              secondary: '#fff',
            },
          },
        }}
      />
      {/* Network Warning Banner */}
      {isWrongNetwork && (
        <div className="bg-brand-red/90 text-white p-3 text-center fixed top-0 inset-x-0 z-50 flex justify-center items-center gap-3 backdrop-blur-md">
          <span className="font-bold">⚠️ Wrong Network Detected</span>
          <span className="text-sm opacity-90 hidden sm:inline">Connect to Paseo Asset Hub to interact with the blockchain.</span>
          <button
            onClick={switchNetwork}
            className="bg-white/20 text-white border border-white/30 px-3 py-1.5 rounded-md text-sm hover:bg-white/30 transition-colors"
          >
            Switch
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative w-full pb-20 md:pb-0">

        {/* Navbar - hidden on landing, maybe hidden entirely on mobile in favor of bottom nav later */}
        {!isLanding && <Navbar address={address} step={step} setStep={setStep} />}

        {/* ===== LANDING / HERO ===== */}
        {step === 'connect' && (
          <section className="flex flex-col items-center justify-center min-h-[100dvh] p-6 lg:p-12 relative z-10 override-landing-bg">
            {/* Subtle background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-red/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
              {/* Left Column: Text Content */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1">
                <h1 className="font-serif text-[clamp(3rem,10vw,6rem)] font-black tracking-tighter leading-none text-brand-red mb-6 animate-fade-slide-up">
                  Token42
                </h1>
                <p className="text-[clamp(1.2rem,4vw,1.8rem)] text-brand-light/90 max-w-[550px] leading-tight font-bold mb-10 animate-fade-slide-up [animation-delay:100ms]">
                  Match. Stake. Connect. <br className="hidden sm:block" />
                  A decentralized dating experience.
                </p>
                <button
                  className="w-full max-w-[320px] py-5 px-10 bg-brand-red hover:bg-brand-darkred text-white font-bold text-xl rounded-full shadow-[0_4px_30px_rgba(255,131,116,0.4)] transition-all duration-300 hover:scale-[1.05] active:scale-[0.95] flex items-center justify-center gap-3 animate-fade-slide-up [animation-delay:200ms]"
                  onClick={connectWallet}
                >
                  <Sparkles className="w-6 h-6" />
                  Connect & Begin
                </button>

                <div className="flex gap-8 mt-16 justify-center lg:justify-start animate-fade-slide-up [animation-delay:300ms]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-brand-dark border border-white/10 text-brand-red shadow-lg transition-transform hover:-translate-y-1">
                      <Heart className="w-7 h-7" />
                    </div>
                    <span className="text-sm text-brand-light/70 font-bold">Genuine</span>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-brand-dark border border-white/10 text-brand-red shadow-lg transition-transform hover:-translate-y-1">
                      <Shield className="w-7 h-7" />
                    </div>
                    <span className="text-sm text-brand-light/70 font-bold">Private</span>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-brand-dark border border-white/10 text-brand-red shadow-lg transition-transform hover:-translate-y-1">
                      <User className="w-7 h-7" />
                    </div>
                    <span className="text-sm text-brand-light/70 font-bold">Verified</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Logo */}
              <div className="flex justify-center items-center order-1 lg:order-2 animate-fade-slide-up">
                <div className="relative">
                  {/* Extra layer of glow for the logo */}
                  <div className="absolute inset-0 bg-brand-red/20 blur-3xl rounded-full animate-pulse-soft"></div>
                  <img
                    src="/token42.png"
                    alt="Token42"
                    className="w-[clamp(250px,40vw,500px)] h-auto rounded-full animate-pulse-soft relative z-10 p-4"
                  />
                </div>
              </div>
            </div>
          </section>
        )}
        {/* ===== PROFILE CREATION ===== */}
        {step === 'profile' && (
          <main className="w-full max-w-xl mx-auto p-4 sm:p-6 pb-24 relative z-10 animate-in">
            <div className="flex items-center gap-2 font-extrabold text-xl tracking-tighter mb-6 text-brand-red">
              <img src="/token42.png" alt="Token42" className="w-6 h-6" />
              <span className="font-serif">Setup Profile</span>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-brand-dark rounded-2xl p-5 border border-white/5 shadow-lg">

                <div className="mb-6 border-b border-white/5 pb-5">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold tracking-tight text-brand-light m-0">Your Details</h2>
                    <StatusBadge status="verified" label="Identity Verified" />
                  </div>
                </div>

                {/* Wallet & Stats Strip */}
                <div className="flex justify-between items-center bg-black/30 rounded-xl p-3 mb-6 border border-white/5">
                  <div className="flex gap-4">
                    <div className="text-center">
                      <span className="block text-sm font-bold text-brand-light">{matches.length}</span>
                      <span className="text-[0.65rem] text-brand-light/50 uppercase">Matches</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-sm font-bold text-brand-light">{Object.keys(chatMessages).length}</span>
                      <span className="text-[0.65rem] text-brand-light/50 uppercase">Chats</span>
                    </div>
                    <div className="text-center border-l border-white/10 pl-4">
                      <span className="block text-sm font-bold text-brand-red">{parseFloat(rusdBalance).toFixed(2)}</span>
                      <span className="text-[0.65rem] text-brand-light/50 uppercase">rUSD</span>
                    </div>
                  </div>
                  <button
                    className="bg-brand-red/10 text-brand-red hover:bg-brand-red hover:text-white transition-colors p-2 rounded-lg"
                    onClick={getFaucetrUSD}
                    disabled={loading}
                    title="Get testing tokens"
                  >
                    <Gift className="w-4 h-4" />
                  </button>
                </div>

                {/* Avatar Upload */}
                <div className="flex flex-col items-center mb-8">
                  <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-input')?.click()}>
                    <div className={`w-32 h-32 rounded-full overflow-hidden border-2 border-brand-red p-1 transition-transform ${!profile.avatar && !localAvatarPreview ? 'border-dashed border-white/20' : ''}`}>
                      <div className="w-full h-full rounded-full bg-brand-black flex items-center justify-center overflow-hidden">
                        {localAvatarPreview || profile.avatar ? (
                          <img
                            src={localAvatarPreview || cachedAvatarUrls[profile.avatar!] || `https://gateway.pinata.cloud/ipfs/${profile.avatar}`}
                            className="w-full h-full object-cover"
                            alt="Avatar"
                          />
                        ) : (
                          <Camera className="w-10 h-10 text-white/20" />
                        )}
                      </div>
                    </div>
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  </div>
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
                </div>

                {imageToCrop && (
                  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-brand-dark w-full max-w-sm rounded-2xl flex flex-col overflow-hidden border border-white/10 h-[500px]">
                      <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="font-bold text-brand-light m-0">Crop Photo</h3>
                      </div>
                      <div className="flex-1 relative bg-black">
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
                      <div className="p-4 bg-brand-dark">
                        <input
                          type="range"
                          value={zoom}
                          min={1}
                          max={3}
                          step={0.1}
                          onChange={(e) => setZoom(Number(e.target.value))}
                          className="w-full accent-brand-red mb-4"
                        />
                        <div className="flex gap-3">
                          <button className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-brand-light transition-colors" onClick={() => setImageToCrop(null)}>Cancel</button>
                          <button className="flex-1 py-3 px-4 rounded-xl bg-brand-red hover:bg-brand-darkred text-white font-bold transition-colors" onClick={handleCropConfirm}>Confirm</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Inputs */}
                <div className="mb-5">
                  <label className="block mb-2 text-brand-light/60 text-xs font-semibold tracking-wide uppercase">First Name</label>
                  <input
                    type="text"
                    className="w-full bg-black/30 border border-white/10 rounded-xl py-3.5 px-4 text-brand-light focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-all"
                    placeholder="What should we call you?"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>

                <div className="mb-6">
                  <label className="block mb-2 text-brand-light/60 text-xs font-semibold tracking-wide uppercase">About Me</label>
                  <textarea
                    placeholder="Share a bit about yourself..."
                    className="w-full bg-black/30 border border-white/10 rounded-xl py-3.5 px-4 text-brand-light focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-all min-h-[120px] resize-none"
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    disabled={loading}
                    maxLength={500}
                  />
                  <div className="text-right text-xs text-brand-light/40 mt-1">{profile.bio.length}/500</div>
                </div>

                <button
                  onClick={createProfile}
                  className="w-full py-4 px-6 bg-brand-red hover:bg-brand-darkred text-white font-bold rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex justify-center items-center"
                  disabled={loading || !profile.bio || (userCID ? !hasChanges : false)}
                >
                  {loading ? (
                    <span className="flex items-center gap-2 animate-pulse"><Sparkles className="w-5 h-5" /> Processing...</span>
                  ) : (
                    userCID ? (hasChanges ? "Update Profile" : "Profile Up To Date") : "Complete Setup"
                  )}
                </button>

                <div className="mt-8 pt-4 border-t border-white/5 flex flex-wrap gap-2 justify-center">
                  <button
                    className="text-xs text-brand-light/40 hover:text-brand-light px-3 py-1.5 rounded-md bg-white/5 transition-colors flex items-center gap-1"
                    onClick={revokeXmtpInstallations}
                  >
                    <Lock className="w-3 h-3" /> Rescue XMTP
                  </button>
                  <button
                    className="text-xs text-brand-red/70 hover:text-brand-red px-3 py-1.5 rounded-md bg-brand-red/10 transition-colors flex items-center gap-1"
                    onClick={clearXmtpOpfs}
                  >
                    <LogOut className="w-3 h-3" /> Clear Db
                  </button>
                </div>

              </div>
            </div>
          </main>
        )}

        {/* ===== DISCOVERY / MATCHING ===== */}
        {step === 'matching' && (
          <main className="flex-1 p-4 sm:p-6 pb-24 max-w-3xl mx-auto w-full relative z-10 animate-in">

            <div className="flex justify-between items-center mb-6 px-2">
              <div>
                <div className="flex items-center gap-2 font-extrabold text-xl tracking-tighter text-brand-red mb-1">
                  <img src="/token42.png" alt="Token42" className="w-6 h-6" />
                  <span className="font-serif">Discovery</span>
                </div>
                <p className="text-brand-light/60 text-sm">Find your next connection</p>
              </div>

              <div className="flex gap-3 items-center">
                {!isProfileComplete && (
                  <button
                    className="p-2.5 bg-brand-red/10 border border-brand-red/20 rounded-xl text-brand-red hover:bg-brand-red hover:text-white transition-colors"
                    onClick={() => setIsMatchLockModalOpen(true)}
                    title="Profile Incomplete"
                  >
                    <Lock className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={findMatches}
                  className="py-2.5 px-5 bg-brand-red hover:bg-brand-darkred text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_4px_15px_rgba(209,45,36,0.2)]"
                  disabled={loading || !isProfileComplete}
                >
                  {loading ? <span className="animate-pulse">Scanning...</span> : (
                    <>
                      <Search className="w-4 h-4" />
                      Find Matches
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {matches.length === 0 && !loading && (
                <div className="bg-brand-dark border border-white/5 rounded-3xl p-10 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-brand-red/10 flex items-center justify-center mb-6 text-brand-red">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-brand-light mb-2">Ready to Mingle?</h3>
                  <p className="text-brand-light/60 max-w-[280px]">Tap 'Find Matches' to let your AI Cupid discover curated potential connections.</p>
                </div>
              )}

              {loading && matches.length === 0 && (
                <div className="bg-brand-dark border border-white/5 rounded-3xl p-10 flex flex-col items-center text-center animate-pulse">
                  <div className="w-20 h-20 rounded-full bg-brand-red/10 flex items-center justify-center mb-6 text-brand-red">
                    <Heart className="w-10 h-10 animate-ping" />
                  </div>
                  <h3 className="text-xl font-bold text-brand-light mb-2">Analyzing Compatibility...</h3>
                  <p className="text-brand-light/60">Searching the network for high-intent matches.</p>
                </div>
              )}

              {matches.length > 0 && (
                <div className="relative w-full max-w-md mx-auto h-[650px]">
                  {/* Tinder-like stacked cards effect */}
                  {matches.map((m, i) => (
                    <div
                      key={i}
                      className="absolute inset-0 w-full h-full bg-brand-dark rounded-3xl overflow-hidden border border-white/10 shadow-2xl animate-in"
                      style={{
                        zIndex: matches.length - i,
                        transform: `scale(${1 - i * 0.05}) translateY(${i * 15}px)`,
                        opacity: 1 - i * 0.2
                      }}
                    >
                      <div className="absolute inset-x-0 top-0 h-2/3 bg-black">
                        <div className={`w-full h-full ${!revealedUsers.has(m.matchAddress.toLowerCase()) ? 'blur-md scale-110' : ''} transition-all duration-500`}>
                          {m.avatar ? (
                            <img src={cachedAvatarUrls[m.avatar] || `https://gateway.pinata.cloud/ipfs/${m.avatar}`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
                              <User className="w-24 h-24 mb-4" />
                              <span className="font-mono">{m.matchAddress.slice(2, 6).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/20 to-transparent"></div>
                      </div>

                      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-brand-dark via-brand-dark to-brand-dark/95 backdrop-blur-sm">
                        <div className="flex justify-between items-end mb-3">
                          <h3 className="text-2xl font-bold font-sans text-brand-light">
                            {m.matchName || "Anonymous"}
                            <span className="text-brand-light/40 font-mono text-sm ml-2 font-normal">{m.matchAddress.slice(0, 6)}</span>
                          </h3>
                          <div className="flex flex-col items-center justify-center bg-black/40 rounded-full w-14 h-14 border border-brand-red/30">
                            <span className="text-xs text-brand-light/60 font-semibold mb-0.5">Match</span>
                            <span className="text-sm font-extrabold text-brand-red">{(m.score / 100).toFixed(0)}%</span>
                          </div>
                        </div>

                        <p className="text-sm text-brand-light/70 leading-relaxed line-clamp-3 mb-6 min-h-[60px]">
                          {m.matchBio || "This user is quite mysterious. No bio provided."}
                        </p>

                        <div className="flex gap-4">
                          {chatMessages[m.matchAddress] || Object.keys(chatMessages).some(k => k.toLowerCase() === m.matchAddress.toLowerCase()) ? (
                            <button
                              onClick={() => {
                                const actualKey = Object.keys(chatMessages).find(k => k.toLowerCase() === m.matchAddress.toLowerCase()) || m.matchAddress;
                                setActiveChat(actualKey);
                                setStep('chat');
                              }}
                              className="w-full py-4 text-center bg-brand-red hover:bg-brand-darkred text-white font-bold rounded-2xl transition-all shadow-[0_4px_15px_rgba(209,45,36,0.3)] hover:-translate-y-0.5 flex items-center justify-center gap-2"
                            >
                              <MessageCircle className="w-5 h-5" />
                              Open Chat
                            </button>
                          ) : (
                            <button
                              onClick={() => stakeAndMessage(m)}
                              className="w-full py-4 text-center bg-brand-red hover:bg-brand-darkred text-white font-bold rounded-2xl transition-all shadow-[0_4px_15px_rgba(209,45,36,0.3)] hover:-translate-y-0.5 flex items-center justify-center gap-2"
                              disabled={loading}
                            >
                              <Gift className="w-5 h-5" />
                              {loading ? "Staking..." : "Stake to Connect"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        )}

        {/* ===== CHAT ===== */}
        {step === 'chat' && (
          <main className="flex-1 w-full relative z-10 flex flex-col h-full overflow-hidden">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[400px_1fr] h-full min-h-0 animate-in overflow-hidden border-t border-white/10">
              {/* Chat Sidebar / Mobile Dropdown */}
              <div className={`flex flex-col h-full bg-brand-black border-r border-white/5 overflow-hidden transition-all ${isMobileSessionOpen ? 'fixed inset-0 z-[200]' : 'hidden md:flex'}`}>
                <div
                  className="p-5 border-b border-white/5 flex justify-between items-center bg-brand-dark md:bg-transparent"
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-brand-red" />
                    <h3 className="font-bold text-lg text-brand-light font-serif">Messages</h3>
                  </div>
                  <button
                    className="md:hidden p-2 text-brand-light/60 hover:text-brand-light"
                    onClick={() => setIsMobileSessionOpen(false)}
                  >
                    Close
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto w-full">
                  {Object.keys(chatMessages).length === 0 ? (
                    <div className="p-6 text-center text-brand-light/40 text-sm">
                      No active conversations yet. Match with someone to start chatting!
                    </div>
                  ) : (
                    Object.keys(chatMessages).map((addr) => (
                      <div
                        key={addr}
                        className={`flex items-center gap-4 p-4 cursor-pointer transition-all duration-200 border-b border-white/5 ${activeChat === addr ? 'bg-brand-red/10 border-l-4 border-l-brand-red' : 'hover:bg-white/5 border-l-4 border-l-transparent'}`}
                        onClick={() => {
                          setActiveChat(addr);
                          setIsMobileSessionOpen(false);
                        }}
                      >
                        <div className={`w-14 h-14 rounded-full bg-brand-dark flex items-center justify-center font-extrabold text-lg text-white flex-shrink-0 border border-white/10 overflow-hidden ${!revealedUsers.has(addr.toLowerCase()) ? 'blur-sm saturate-0' : ''}`}>
                          {matches.find(m => m.matchAddress.toLowerCase() === addr.toLowerCase())?.avatar ? (
                            <img
                              src={cachedAvatarUrls[matches.find(m => m.matchAddress.toLowerCase() === addr.toLowerCase())?.avatar!] || `https://gateway.pinata.cloud/ipfs/${matches.find(m => m.matchAddress.toLowerCase() === addr.toLowerCase())?.avatar}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6 text-brand-light/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <div className="font-bold truncate text-brand-light font-sans text-base">
                              {matches.find(m => m.matchAddress.toLowerCase() === addr.toLowerCase())?.matchName || `${addr.slice(0, 6)}...`}
                            </div>
                          </div>
                          <div className="text-sm text-brand-light/50 truncate">
                            {chatMessages[addr].length > 0
                              ? chatMessages[addr][chatMessages[addr].length - 1].text
                              : "New match! Say hello."}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Chat Main */}
              <div className="flex bg-brand-dark flex-col h-full relative overflow-hidden">
                {/* Mobile Header trigger */}
                <div className="md:hidden p-4 border-b border-white/5 bg-brand-black flex items-center gap-3">
                  <button onClick={() => setIsMobileSessionOpen(true)} className="p-2 -ml-2 text-brand-red">
                    <MessageCircle className="w-6 h-6" />
                  </button>
                  {activeChat ? (
                    <div className="font-bold flex-1 text-center truncate pr-8">
                      {matches.find(m => m.matchAddress.toLowerCase() === activeChat.toLowerCase())?.matchName || `${activeChat.slice(0, 6)}...`}
                    </div>
                  ) : (
                    <div className="font-bold flex-1 text-center text-brand-light/60">Select Chat</div>
                  )}
                </div>

                {activeChat ? (
                  <>
                    <div className="p-5 border-b border-white/5 bg-black/40 backdrop-blur-md flex justify-between items-center sticky top-0 z-[50]">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full overflow-hidden border border-white/10 ${!revealedUsers.has(activeChat.toLowerCase()) ? 'blur-sm saturate-0' : ''}`}>
                          {matches.find(m => m.matchAddress.toLowerCase() === activeChat.toLowerCase())?.avatar ? (
                            <img
                              src={cachedAvatarUrls[matches.find(m => m.matchAddress.toLowerCase() === activeChat.toLowerCase())?.avatar!] || `https://gateway.pinata.cloud/ipfs/${matches.find(m => m.matchAddress.toLowerCase() === activeChat.toLowerCase())?.avatar}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-brand-dark flex items-center justify-center"><User className="w-6 h-6 text-brand-light/40" /></div>
                          )}
                        </div>
                        <div>
                          <div className="text-lg font-bold text-brand-light font-sans flex items-center gap-2">
                            {matches.find(m => m.matchAddress.toLowerCase() === activeChat.toLowerCase())?.matchName || `${activeChat.slice(0, 8)}...${activeChat.slice(-4)}`}
                          </div>
                          <p className="text-xs text-brand-light/50 mt-0.5 font-mono">
                            {activeChat}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <button
                          className="bg-brand-red/10 text-brand-red hover:bg-brand-red hover:text-white transition-colors p-2.5 rounded-xl disabled:opacity-50 flex items-center gap-2 font-bold text-sm"
                          onClick={() => {
                            checkDateStatus(activeChat);
                            setIsPoRLModalOpen(true);
                          }}
                          disabled={blockedUsers.some(u => u.toLowerCase() === activeChat?.toLowerCase())}
                        >
                          <Heart className="w-4 h-4 fill-current" />
                          <span className="hidden sm:inline">
                            {dateEscrowStatus?.status === 2 ? 'Verify Date' : 'Ask Out'}
                          </span>
                        </button>

                        <div className="relative">
                          <button
                            className="bg-black/30 border border-white/10 text-brand-light hover:bg-white/10 p-2.5 rounded-xl transition-all"
                            onClick={() => setIsChatMenuOpen(!isChatMenuOpen)}
                            title="More Actions"
                            disabled={blockedUsers.some(u => u.toLowerCase() === activeChat?.toLowerCase())}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                          </button>
                          {isChatMenuOpen && (
                            <div className="absolute right-0 top-[calc(100%+8px)] z-[100] p-2 min-w-[200px] flex flex-col gap-1 bg-brand-dark border border-white/10 rounded-xl shadow-2xl backdrop-blur-md">
                              <button
                                className={`w-full text-left p-3 text-sm rounded-lg transition-colors flex items-center gap-3 ${showRecipientBio ? 'text-brand-red bg-brand-red/10' : 'text-brand-light hover:bg-white/5'}`}
                                onClick={() => { setShowRecipientBio(!showRecipientBio); setIsChatMenuOpen(false); }}
                              >
                                <User className="w-4 h-4" />
                                {showRecipientBio ? 'Hide Bio' : 'View Bio'}
                              </button>
                              <button
                                className="w-full text-left p-3 text-sm rounded-lg transition-colors text-brand-red hover:bg-brand-red/10 flex items-center gap-3"
                                onClick={() => { handleReport(activeChat); setIsChatMenuOpen(false); }}
                              >
                                <Lock className="w-4 h-4" />
                                Report User
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {showRecipientBio && (
                      <div className="p-4 bg-black/50 border-b border-white/5 animate-in">
                        <h4 className="text-xs text-brand-red font-bold uppercase tracking-wider mb-2">About Them</h4>
                        <div className="text-sm text-brand-light leading-relaxed">
                          {matches.find(m => m.matchAddress.toLowerCase() === activeChat.toLowerCase())?.matchBio || "No bio available."}
                        </div>
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-dark via-brand-black to-brand-black">
                      {(chatMessages[activeChat] || []).map((msg, i) => (
                        <div key={i} className={`max-w-[85%] sm:max-w-[75%] p-5 rounded-3xl text-lg leading-snug break-words shadow-sm ${msg.sent ? 'bg-brand-red text-white self-end rounded-br-sm' : 'bg-brand-dark border border-white/10 text-brand-light self-start rounded-bl-sm'}`}>
                          {msg.text}
                        </div>
                      ))}

                      {/* Instant Reveal Button for Staked High Intent */}
                      {!revealedUsers.has(activeChat.toLowerCase()) && (
                        <div className="sticky bottom-0 mt-8 p-4 bg-gradient-to-t from-brand-black via-brand-black/90 to-transparent flex justify-center w-full pb-8">
                          <button
                            className="w-full sm:w-auto py-3 px-8 bg-brand-dark border border-brand-red/50 hover:bg-brand-red/20 text-brand-red font-bold rounded-full transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
                            onClick={() => burnForReveal(activeChat)}
                          >
                            <Sparkles className="w-5 h-5" />
                            Reveal Photos (5 rUSD)
                          </button>
                        </div>
                      )}

                      {chatMessages[activeChat]?.length === 0 && !hasActiveStake && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-50 my-10">
                          <MessageCircle className="w-16 h-16 mb-4 text-brand-light/30" />
                          <p className="text-brand-light">Break the ice. Say something nice!</p>
                        </div>
                      )}

                      {/* Overlays */}
                      {hasActiveStake && (
                        <div className="absolute inset-x-0 bottom-24 mx-4 p-6 bg-brand-dark/95 border border-brand-red backdrop-blur-md rounded-2xl flex flex-col items-center text-center shadow-2xl animate-in fade-in slide-in-from-bottom-5">
                          <div className="w-16 h-16 rounded-full bg-brand-red/20 flex flex-col items-center justify-center mb-4 text-brand-red">
                            <Gift className="w-8 h-8" />
                          </div>
                          <h3 className="text-xl font-bold mb-2">You Have a Matched Stake!</h3>
                          <p className="text-brand-light/70 text-sm mb-6 max-w-[280px]">They have committed tokens. Claim them to unlock the session.</p>
                          <button
                            className="w-full py-3.5 bg-brand-red hover:bg-brand-darkred text-white font-bold rounded-xl transition-all"
                            onClick={claimStake}
                            disabled={loading}
                          >
                            {loading ? "Processing..." : "Claim & Unlock"}
                          </button>
                        </div>
                      )}

                      {dateEscrowStatus?.status === 1 && dateEscrowStatus.userB.toLowerCase() === address?.toLowerCase() && (
                        <div className="absolute inset-x-0 bottom-24 mx-4 p-6 bg-brand-dark/95 border border-brand-red backdrop-blur-md rounded-2xl flex flex-col items-center text-center shadow-2xl animate-in fade-in slide-in-from-bottom-5">
                          <div className="w-16 h-16 rounded-full bg-brand-red/20 flex flex-col items-center justify-center mb-4 text-brand-red">
                            <img src="/token42.png" alt="Token42" className="w-8 h-8" />
                          </div>
                          <h3 className="text-xl font-bold mb-2">Activity Proposed</h3>
                          <p className="text-brand-light/70 text-sm mb-6 max-w-[280px]">They proposed a verified meetup. Stake 10 rUSD to say yes.</p>
                          <button
                            className="w-full py-3.5 bg-brand-red hover:bg-brand-darkred text-white font-bold rounded-xl transition-all"
                            onClick={() => { setIsPoRLModalOpen(true); }}
                          >
                            Review & Accept
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 bg-brand-black border-t border-white/5">
                      <div className="bg-black/40 border border-white/10 rounded-2xl flex items-end p-2 transition-all focus-within:border-brand-red">
                        <textarea
                          ref={chatTextareaRef}
                          className="flex-1 bg-transparent border-none text-brand-light py-3 px-4 focus:outline-none placeholder:text-brand-light/30 resize-none min-h-[50px] max-h-[150px] text-lg"
                          placeholder={blockedUsers.some(u => u.toLowerCase() === activeChat?.toLowerCase()) ? "Session restricted" : "Type a message..."}
                          value={chatInput}
                          onChange={(e) => {
                            handleChatInputChange(e);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendChat();
                            }
                          }}
                          rows={1}
                          disabled={blockedUsers.some(u => u.toLowerCase() === activeChat?.toLowerCase())}
                        />
                        <button
                          className="bg-brand-red text-white w-11 h-11 rounded-xl m-1 flex items-center justify-center hover:bg-brand-darkred transition-all shrink-0 disabled:opacity-50 disabled:bg-white/10"
                          onClick={sendChat}
                          disabled={!chatInput.trim() || blockedUsers.some(u => u.toLowerCase() === activeChat?.toLowerCase())}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>
                        </button>
                      </div>
                    </div>

                    {blockedUsers.some(u => u.toLowerCase() === activeChat?.toLowerCase()) && (
                      <div className="absolute inset-0 bg-brand-black/95 z-50 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                        <Shield className="w-16 h-16 text-brand-red mb-4" />
                        <h3 className="text-2xl font-bold mb-2 text-brand-light">Session Blocked</h3>
                        <p className="text-brand-light/60 max-w-sm">A conduct violation was detected by AI moderation. Messaging for this session has been disabled.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 hidden md:flex flex-col items-center justify-center text-center p-12 h-full opacity-50">
                    <div className="w-24 h-24 rounded-full bg-brand-dark flex items-center justify-center mb-6">
                      <MessageCircle className="w-10 h-10 text-brand-light/40" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2 text-brand-light font-serif">Your Conversations</h3>
                    <p className="text-brand-light/60 max-w-[300px]">Select a session from the sidebar to continue the connection.</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        )}

        {/* Footer - hidden on landing */}
        {!isLanding && (
          <footer className="mt-auto py-8 text-center text-[#555565] text-[0.85rem] border-t border-[rgba(255,255,255,0.05)]">
            <p>Built on <a href="https://polkadot.network" target="_blank" rel="noopener" className="text-[#8888A0] no-underline hover:text-[#00FFCC]">Polkadot Asset Hub</a> (Revive EVM) & Phala Network</p>
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
            onCancelDate={cancelDate}
            onResolveExpired={resolveExpired}
            onProposeDate={() => proposeDate(activeChat)}
          />
        )}
        {isReportModalOpen && (
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            status={reportModalStatus}
          />
        )}
        {isMatchLockModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm animate-in">
            <GlassCard className="max-w-[450px] w-full text-center p-10 flex flex-col items-center">
              <div className="w-[72px] h-[72px] bg-[#D94A56]/10 rounded-full flex items-center justify-center mb-6 text-[#D94A56]">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <h2 className="text-2xl font-bold mb-2 text-[#3A232A]">Discovery Locked</h2>
              <p className="text-[#8E757E] text-sm leading-relaxed mb-8">
                Your Personal Cupid needs to know you first! Complete the following in the <strong>Profile</strong> tab to unlock discovery:
              </p>
              <div className="w-full flex flex-col gap-3 text-left mb-10">
                <div className={`flex items-center gap-3 p-3 rounded-xl border border-black/5 ${profile.name ? 'bg-[#D94A56]/10' : 'bg-white/50'}`}>
                  <span className="text-lg">{profile.name ? '✅' : '🔴'}</span>
                  <span className={`text-[0.95rem] font-medium ${profile.name ? 'text-[#3A232A]' : 'text-[#8E757E]'}`}>Display Name</span>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-xl border border-black/5 ${profile.bio ? 'bg-[#D94A56]/10' : 'bg-white/50'}`}>
                  <span className="text-lg">{profile.bio ? '✅' : '🔴'}</span>
                  <span className={`text-[0.95rem] font-medium ${profile.bio ? 'text-[#3A232A]' : 'text-[#8E757E]'}`}>Bio Description</span>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-xl border border-black/5 ${profile.avatar ? 'bg-[#D94A56]/10' : 'bg-white/50'}`}>
                  <span className="text-lg">{profile.avatar ? '✅' : '🔴'}</span>
                  <span className={`text-[0.95rem] font-medium ${profile.avatar ? 'text-[#3A232A]' : 'text-[#8E757E]'}`}>Profile Photo</span>
                </div>
              </div>
              <button
                className="w-full py-3.5 px-6 bg-gradient-to-br from-[#D94A56] to-[#E58A8A] border-none text-white font-bold rounded-full cursor-pointer shadow-[0_4px_15px_rgba(217,74,86,0.3)] transition-all duration-300 hover:-translate-y-0.5"
                onClick={() => {
                  setIsMatchLockModalOpen(false);
                  setStep('profile');
                }}
              >
                Go to Profile →
              </button>
              <button
                className="mt-4 bg-transparent border-none text-brand-light/50 font-medium cursor-pointer hover:text-brand-light transition-colors"
                onClick={() => setIsMatchLockModalOpen(false)}
              >
                Close
              </button>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
