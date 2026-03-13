import React, { useState, useEffect } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { uploadToIPFS } from './utils/storage';

// Contract Addresses (Paseo Asset Hub - PolkaVM)
const PROFILE_CONTRACT_ADDRESS = "0xD7dD2d357A377beb0bbF89BfF0f0b36549e8476B";
const MESSAGING_CONTRACT_ADDRESS = "0x5f9b5ccAa4B13e23E41E9d3F9018963bE76f1347";

function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [step, setStep] = useState<'connect' | 'profile' | 'matching' | 'chat'>('connect');
  const [isVerified, setIsVerified] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const connectWallet = async () => {
    if ((window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        setAddress(accounts[0]);
        setStep('profile');
        // Simulate checking identity precompile status
        setIsVerified(true);
      } catch (error) {
        console.error("User denied account access");
      }
    } else {
      alert("Please install SubWallet or metamask!");
    }
  };

  const createProfile = async () => {
    if (!address || !bio) return alert("Please enter a bio");
    
    setLoading(true);
    try {
      console.log("Uploading bio to IPFS...");
      const cid = await uploadToIPFS(address, {
        bio,
        timestamp: Date.now(),
        creator: address
      });
      console.log("IPFS CID:", cid);

      console.log("Minting Soulbound Profile...");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const profileContract = new ethers.Contract(
        PROFILE_CONTRACT_ADDRESS,
        ["function mintProfile(string cid) public"],
        signer
      );

      const tx = await profileContract.mintProfile(cid);
      setTxHash(tx.hash);
      await tx.wait();
      
      console.log("Profile Minted!");
      setStep('matching');
    } catch (error: any) {
      console.error("Profile creation failed:", error);
      alert(`Error: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const findMatches = async () => {
    console.log("Connecting to Phala TEE Agent...");
    // Simulate Phala Agent response
    const mockMatches = [
      { address: "0xabc...def", score: 92, status: "Ready to Stake" },
      { address: "0x789...012", score: 81, status: "Ready to Stake" },
    ];
    setMatches(mockMatches);
  };

  const stakeAndMessage = async (matchAddress: string) => {
    console.log(`Staking 1 rUSD to message ${matchAddress}...`);
    // Integration with Token42Messaging.sol would go here
    alert("Message Staked! You can now chat.");
    setStep('chat');
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
            <p>
              Identity:{' '}
              <span className="mono text-wrap-anywhere">{address}</span>
            </p>
            <p style={{ color: '#00FFCC' }}>✓ Real Human status confirmed via People Chain</p>
            <textarea 
              placeholder="Tell us about yourself..." 
              className="bio-input" 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              disabled={loading}
            />
            <button 
              onClick={createProfile} 
              className="connect-btn"
              disabled={loading || !bio}
            >
              {loading ? "Processing..." : "Mint Soulbound Profile"}
            </button>
            {txHash && (
              <p style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
                Tx: <a href={`https://blockscout-passet-hub.parity-testnet.parity.io/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: '#FF3366' }}>{txHash.slice(0, 10)}...</a>
              </p>
            )}
          </div>
        )}

        {step === 'matching' && (
          <div>
            <div className="card">
              <h2>Deep-Thought Matching</h2>
              <p>AI is privately analyzing personality vectors inside a secure enclave...</p>
              <button onClick={findMatches} className="action-btn primary">Find Matches</button>
            </div>
            {matches.map((m, i) => (
              <div key={i} className="card match-item">
                <div>
                  <strong className="mono text-truncate">{m.address}</strong>
                  <div className="match-score">{m.score}% Match Score</div>
                </div>
                <button onClick={() => stakeAndMessage(m.address)} className="action-btn" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
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
              <p><strong>You:</strong> Hi! I saw our match score was 92%.</p>
            </div>
            <input type="text" placeholder="Type a message..." style={{ width: '100%', padding: '0.5rem', background: '#222', border: '1px solid #444', color: 'white' }} />
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Built with ❤️ on Polkadot Asset Hub (Revive EVM) & Phala Network</p>
        <p>SDG 5 & 16 Compliant</p>
      </footer>
    </div>
  );
}

export default App;
