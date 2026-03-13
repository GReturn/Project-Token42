import React, { useState, useEffect } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { uploadToIPFS, fetchFromIPFS, UserProfile } from './utils/storage';
import { toast, Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Loading from './components/Loading';
import GlassCard from './components/GlassCard';
import StatusBadge from './components/StatusBadge';

// Contract Addresses (Paseo Asset Hub - PolkaVM)
const PROFILE_CONTRACT_ADDRESS = "0xD7dD2d357A377beb0bbF89BfF0f0b36549e8476B";
const MESSAGING_CONTRACT_ADDRESS = "0x5f9b5ccAa4B13e23E41E9d3F9018963bE76f1347";
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
  "function nonces(address user) public view returns (uint256)",
  "function matches(bytes32 matchId) public view returns (address sender, address recipient, uint256 stake, bool active)"
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
  const [chatMessages, setChatMessages] = useState([
    { text: "Hi! I saw our match score was high. Want to chat about decentralized systems?", sent: true }
  ]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [initialProfile, setInitialProfile] = useState<UserProfile | null>(null);

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

  const createProfile = async () => {
    if (!address || !profile.bio) return toast.error("Please enter a bio");
    setLoading(true);
    try {
      const metadata: UserProfile = {
        ...profile,
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
      setInitialProfile(metadata);
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
      const potentialMatches = [
        { 
          address: "0x375ac89e80AE2169EC049B5780831A58bab5f7e3", 
          cid: "QmX123...mock",
          personalityBio: "I am a passionate explorer of decentralized systems and artificial intelligence. Looking for someone to build the future with."
        },
      ];

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
        setMatches([data]);
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

      toast.success("Message Staked! You can now chat.");
      setStep('chat');
    } catch (error: any) {
      console.error("Staking failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { text: chatInput, sent: true }]);
    setChatInput('');
  };

  const isLanding = step === 'connect';

      const hasChanges = !userCID || (
    profile.name !== initialProfile?.name || 
    profile.bio !== initialProfile?.bio
  );

  return (
    <div className="App">
      {(loading || isConnecting) && (
        <Loading message={isConnecting ? "Connecting Wallet..." : "Processing Transaction..."} />
      )}
      <Toaster 
        position="top-right"
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
          <div className="dashboard-grid animate-in">
            <GlassCard>
              <div className="step-indicator">
                <div className="step-dot completed" />
                <div className="step-line" />
                <div className="step-dot active" />
                <div className="step-line" />
                <div className="step-dot" />
              </div>

              <div className="card-header">
                <h2>Create Your Profile</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                  Identity verified via People Chain <StatusBadge status="verified" label="Verified" />
                </p>
              </div>
              
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
          <div className="dashboard-grid animate-in">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.5px' }}>Discovery</h2>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>AI-guided matches based on personality vectors</p>
                </div>
                <button 
                  onClick={findMatches} 
                  className="primary-btn" 
                  style={{ width: 'auto', padding: '0.7rem 1.5rem' }}
                  disabled={loading}
                >
                  {loading ? <span className="loading-pulse">Scanning...</span> : "Find Matches"}
                </button>
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
                      <div className="match-avatar">
                        {m.matchAddress ? m.matchAddress.slice(2, 4).toUpperCase() : '??'}
                      </div>
                      <div className="match-info">
                        <h3>{m.matchAddress.slice(0, 10)}...{m.matchAddress.slice(-6)}</h3>
                        <p>{m.matchBio || "Passionate about decentralized systems and AI. Looking for someone to build the future with."}</p>
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
        <main className="main">
          <GlassCard className="chat-container animate-in">
            <div className="chat-header">
              <div className="chat-header-info">
                <h2>Secure Chat</h2>
                <p>End-to-end verified. Harassment = stake slashed.</p>
              </div>
              <StatusBadge status="verified" label="Staked 1 rUSD" />
            </div>

            <div className="chat-messages">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`chat-bubble ${msg.sent ? 'sent' : 'received'}`}>
                  {msg.text}
                </div>
              ))}
            </div>

            <div className="chat-input-bar">
              <input 
                className="chat-input" 
                placeholder="Type a message..." 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              />
              <button className="chat-send-btn" onClick={sendChat}>Send</button>
            </div>
          </GlassCard>
        </main>
      )}

      {/* Footer - hidden on landing */}
      {!isLanding && (
        <footer className="app-footer">
          <p>Built on <a href="https://polkadot.network" target="_blank" rel="noopener">Polkadot Asset Hub</a> (Revive EVM) & Phala Network</p>
        </footer>
      )}
    </div>
  );
}

export default App;
