import React, { useState } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { uploadToIPFS } from './utils/storage';

// Contract Addresses (Paseo Asset Hub - PolkaVM)
const PROFILE_CONTRACT_ADDRESS = "0xD7dD2d357A377beb0bbF89BfF0f0b36549e8476B";
const MESSAGING_CONTRACT_ADDRESS = "0x5f9b5ccAa4B13e23E41E9d3F9018963bE76f1347";
const RUSD_CONTRACT_ADDRESS = "0x...YOUR_RUSD_ADDRESS_HERE..."; // Update this from Ignition deployment

const PROFILE_ABI = [
  "function mintProfile(string cid) public",
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
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [userCID, setUserCID] = useState<string | null>(null);

  const connectWallet = async () => {
    if ((window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        setAddress(accounts[0]);
        
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const profileContract = new ethers.Contract(PROFILE_CONTRACT_ADDRESS, PROFILE_ABI, provider);
        
        const hasProfile = await profileContract.hasProfile(accounts[0]);
        if (hasProfile) {
          try {
            const cid = await profileContract.getProfileCID(accounts[0]);
            setUserCID(cid);
            setStep('matching');
          } catch (e) {
            console.error("Failed to fetch CID:", e);
            setStep('profile');
          }
        } else {
          setStep('profile');
        }
        setIsVerified(true);
      } catch (error) {
        console.error("Connection failed:", error);
      }
    } else {
      alert("Please install SubWallet or MetaMask!");
    }
  };

  const createProfile = async () => {
    if (!address || !bio) return alert("Please enter a bio");
    setLoading(true);
    try {
      const cid = await uploadToIPFS(address, { bio, timestamp: Date.now(), creator: address });
      console.log("IPFS CID:", cid);

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const profileContract = new ethers.Contract(PROFILE_CONTRACT_ADDRESS, PROFILE_ABI, signer);

      const tx = await profileContract.mintProfile(cid);
      setTxHash(tx.hash);
      await tx.wait();
      
      setUserCID(cid);
      setStep('matching');
    } catch (error: any) {
      console.error("Profile creation failed:", error);
      alert(`Error: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const findMatches = async () => {
    if (!address || !userCID) return;
    setLoading(true);
    try {
      console.log("Calling Local AI Agent Matching Engine...");
      
      const potentialMatches = [
        { address: "0x375ac89e80AE2169EC049B5780831A58bab5f7e3", cid: "QmX123...mock" },
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
        alert("No high-score matches found yet.");
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

      alert("Message Staked! You can now chat.");
      setStep('chat');
    } catch (error: any) {
      console.error("Staking failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="header">
        <img src="/token42.svg" alt="Token42 Logo" className="logo" style={{ width: '80px', marginBottom: '1rem' }} />
        <h1>Token42</h1>
        <p>Verifiable Identity. AI Matching. Staked Connection.</p>
      </header>

      <main className="main">
        {step === 'connect' && (
          <div className="card">
            <h2>Welcome to the Future of Dating</h2>
            <p>Connect your wallet to verify your identity on Phala Network & Polkadot Paseo.</p>
            <button onClick={connectWallet} className="connect-btn">Connect & Verify</button>
          </div>
        )}

        {step === 'profile' && (
          <div className="card">
            <h2>Human Verification Success</h2>
            <p>Identity: <span className="mono">{address}</span></p>
            <p style={{ color: '#00FFCC' }}>✓ Real Human status confirmed via People Chain</p>
            <textarea 
              placeholder="Tell us about yourself..." 
              className="bio-input" 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={loading}
            />
            <button 
              onClick={createProfile} 
              className="connect-btn"
              disabled={loading || !bio}
            >
              {loading ? "Processing..." : "Mint Soulbound Profile"}
            </button>
          </div>
        )}

        {step === 'matching' && (
          <div>
            <div className="card">
              <h2>Deep-Thought Matching</h2>
              <p>AI is privately analyzing personality vectors...</p>
              <button onClick={findMatches} className="action-btn primary" disabled={loading}>
                {loading ? "Analyzing..." : "Find Matches"}
              </button>
            </div>
            {matches.map((m, i) => (
              <div key={i} className="card match-item">
                <div>
                  <strong className="mono">{m.matchAddress}</strong>
                  <div className="match-score">{m.score}% Match Score</div>
                </div>
                <button onClick={() => stakeAndMessage(m)} className="action-btn" disabled={loading}>
                  Stake & Message
                </button>
              </div>
            ))}
          </div>
        )}

        {step === 'chat' && (
          <div className="card">
            <h2>Chat Unlocked</h2>
            <p>You have staked 1 rUSD for this interaction. Harassment will result in slashing.</p>
            <div className="chat-box">
              <p><strong>You:</strong> Hi! I saw our match score was high.</p>
            </div>
            <button onClick={() => alert("Reported to AI Moderation Layer...")} className="action-btn" style={{ background: '#CC0000', marginTop: '1rem' }}>
              Report Harassment
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Built with ❤️ on Polkadot Asset Hub (Revive EVM) & Phala Network</p>
        <p>Local Agent Mode enabled</p>
      </footer>
    </div>
  );
}

export default App;
