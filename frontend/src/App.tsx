import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { uploadToIPFS, fetchFromIPFS, UserProfile } from './utils/storage';
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
const PROFILE_CONTRACT_ADDRESS = "0xD7dD2d357A377beb0bbF89BfF0f0b36549e8476B";
const MESSAGING_CONTRACT_ADDRESS = "0x5f9b5ccAa4B13e23E41E9d3F9018963bE76f1347";
const ESCROW_CONTRACT_ADDRESS = "0x...YOUR_ESCROW_ADDRESS_HERE..."; // Replace with deployed address
const RUSD_CONTRACT_ADDRESS = "0x...YOUR_RUSD_ADDRESS_HERE...";

const PROFILE_ABI = [
  "function mintProfile(string cid) public",
  "function updateProfile(string newCid) public",
  "function hasProfile(address user) public view returns (bool)",
  "function getProfileCID(address user) public view returns (string)"
];

const MESSAGING_ABI = [
  "function stakeForMessage(address recipient, uint256 matchScore, bytes signature) public",
  "function claimStake(address sender) public",
  "function slashStake(address sender, address recipient) public",
  "function burnForReveal(address recipient) public",
  "function nonces(address user) public view returns (uint256)",
  "function matches(bytes32 matchId) public view returns (address sender, address recipient, uint256 stake, bool active)",
  "event RevealPurchased(address indexed sender, address indexed recipient, uint256 amount)"
];

const ESCROW_ABI = [
  "function proposeDate(address recipient) public",
  "function acceptDate(address proposer) public",
  "function submitProof(address partner, bytes signature) public",
  "function dates(bytes32 dateId) public view returns (address userA, address userB, uint256 startTime, uint256 amountA, uint256 amountB, bool proofA, bool proofB, uint8 status)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)"
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
  const [showRecipientBio, setShowRecipientBio] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [pendingAvatarBlob, setPendingAvatarBlob] = useState<Blob | null>(null);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_CHAT_CHARS = 500;

  useEffect(() => {
    if (address) {
      checkNetwork();
      checkProfileStatus();
    }
  }, [address]);

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
      
      // Specifically check if contract exists at address
      const code = await provider.getCode(PROFILE_CONTRACT_ADDRESS);
      if (code === "0x") {
        console.error("Profile contract not found at address. Are you on the right network?");
        setIsWrongNetwork(true);
        return;
      }

      const hasProfile = await profileContract.hasProfile(address);
      if (hasProfile) {
        const cid = await profileContract.getProfileCID(address);
        setUserCID(cid);
        const metadata = await fetchFromIPFS(cid);
        setProfile(metadata);
        setInitialProfile(metadata);
        setStep('matching');
      } else {
        setStep('profile');
      }
      setIsVerified(true);
    } catch (e) {
      console.error("Failed to check profile status:", e);
    }
  };

  const connectWallet = async () => {
    if ((window as any).ethereum) {
      setIsConnecting(true);
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        setAddress(accounts[0]);
      } catch (error) {
        console.error("Connection failed:", error);
      } finally {
        setIsConnecting(false);
      }
    } else {
      alert("Please install SubWallet or MetaMask!");
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
    setLoading(true);
    try {
      let finalAvatarCID = profile.avatar;

      if (pendingAvatarBlob) {
        toast.loading("Uploading image to IPFS...");
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
      }

      const metadata: UserProfile = {
        ...profile,
        avatar: finalAvatarCID,
        timestamp: Date.now(),
        creator: address
      };
      const cid = await uploadToIPFS(address, metadata);
      console.log("IPFS CID:", cid);

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const profileContract = new ethers.Contract(PROFILE_CONTRACT_ADDRESS, PROFILE_ABI, signer);

      let tx;
      if (userCID) {
        // Profile already exists, update it
        console.log("Updating existing profile...");
        tx = await profileContract.updateProfile(cid);
      } else {
        // No profile found, mint a new one
        console.log("Minting new soulbound profile...");
        tx = await profileContract.mintProfile(cid);
      }

      setTxHash(tx.hash);
      await tx.wait();
      
      setUserCID(cid);
      setProfile(metadata);
      setInitialProfile(metadata);
      setPendingAvatarBlob(null);
      setLocalAvatarPreview(null);
      toast.success(userCID ? "Profile Updated!" : "Soulbound Profile Minted!");
      setStep('matching');
    } catch (error: any) {
      console.error("Profile operation failed:", error);
      alert(`Error: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const findMatches = async () => {
    if (!address || !userCID) return;
    setLoading(true);
    try {
      const potentialMatches: any[] = [];

      const provider = new ethers.BrowserProvider((window as any).ethereum);
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

      const data = await response.json();
      if (data) {
        // Fetch full metadata for the match to get the avatar
        try {
          const metadata = await fetchFromIPFS(data.matchCid);
          setMatches([{ 
            ...data, 
            avatar: metadata.avatar,
            name: metadata.name,
            bio: metadata.bio
          }]);
        } catch (e) {
          console.error("Failed to fetch match metadata:", e);
          setMatches([data]);
        }
      } else {
        toast.error("No high-score matches found yet.");
      }
    } catch (error) {
      console.error("Matching failed:", error);
      alert("Local AI Agent not responding. Is it running on port 3001?");
    } finally {
      setLoading(false);
    }
  };

  const stakeAndMessage = async (match: any) => {
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      const rUSD = new ethers.Contract(RUSD_CONTRACT_ADDRESS, ERC20_ABI, signer);
      const approveTx = await rUSD.approve(MESSAGING_CONTRACT_ADDRESS, ethers.parseEther("1"));
      await approveTx.wait();

      const messaging = new ethers.Contract(MESSAGING_CONTRACT_ADDRESS, MESSAGING_ABI, signer);
      const tx = await messaging.stakeForMessage(
        match.matchAddress,
        match.score,
        match.signature
      );
      setTxHash(tx.hash);
      await tx.wait();

      const recipient = match.matchAddress;
      setActiveChat(recipient);
      if (!chatMessages[recipient]) {
        setChatMessages(prev => ({
          ...prev,
          [recipient]: []
        }));
      }

      toast.success("Message Staked! You can now chat.");
      setStep('chat');
    } catch (error: any) {
      console.error("Staking failed:", error);
      alert(`Error: ${error.message}`);
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
      const approveTx = await rUSD.approve(MESSAGING_CONTRACT_ADDRESS, ethers.parseEther("5"));
      await approveTx.wait();

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
      const approveTx = await rUSD.approve(ESCROW_CONTRACT_ADDRESS, ethers.parseEther("10"));
      await approveTx.wait();

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

  const sendChat = () => {
    if (!chatInput.trim() || !activeChat) return;
    
    setChatMessages(prev => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), { text: chatInput, sent: true }]
    }));
    
    setChatInput('');
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto';
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
              
              <div className="input-group">
                <label className="input-label">Profile Photo</label>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {localAvatarPreview || profile.avatar ? (
                    <img 
                      src={localAvatarPreview || `https://gateway.pinata.cloud/ipfs/${profile.avatar}`} 
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
                          <img src={`https://gateway.pinata.cloud/ipfs/${m.avatar}`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
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
                            strokeDasharray={`${(m.score / 100) * 97.4} 97.4`}
                            strokeLinecap="round" />
                        </svg>
                        <span className="score-text">{m.score}%</span>
                      </div>
                    </div>
                    <div className="match-actions">
                      <button onClick={() => stakeAndMessage(m)} className="primary-btn" disabled={loading}>
                        {loading ? "Processing..." : "Stake & Connect"}
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>

            <aside>
              <GlassCard className="sidebar-card">
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Your Identity</h3>
                <div className="identity-row">
                  <div className="identity-avatar" />
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
                        <img src={`https://gateway.pinata.cloud/ipfs/${matches.find(m => m.matchAddress.toLowerCase() === addr.toLowerCase())?.avatar}`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
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
                    {chatMessages[activeChat]?.length === 0 && (
                      <div className="empty-chat">
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    )}
                  </div>

                  <div className="chat-input-bar">
                    <div style={{ flex: 1, position: 'relative' }}>
                      <textarea 
                        ref={chatTextareaRef}
                        className="chat-input" 
                        placeholder="Type a message..." 
                        value={chatInput} 
                        onChange={handleChatInputChange}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendChat();
                          }
                        }}
                        rows={1}
                      />
                      <div className="chat-char-count">
                        {chatInput.length}/{MAX_CHAT_CHARS}
                      </div>
                    </div>
                    <button className="chat-send-btn" onClick={sendChat}>Send</button>
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
