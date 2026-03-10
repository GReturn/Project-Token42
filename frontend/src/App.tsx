import React, { useState, useEffect } from 'react';
import './App.css';
import { ethers } from 'ethers';

// Contract Addresses (Placeholders for Paseo Testnet)
const PROFILE_CONTRACT_ADDRESS = "0x...";
const MESSAGING_CONTRACT_ADDRESS = "0x...";

function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [step, setStep] = useState<'connect' | 'profile' | 'matching' | 'chat'>('connect');
  const [isVerified, setIsVerified] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);

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
    console.log("Minting Soulbound Profile...");
    // Integration with Token42Profile.sol would go here
    setStep('matching');
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
            <p>Identity: {address}</p>
            <p style={{ color: '#00FFCC' }}>✓ Real Human status confirmed via People Chain</p>
            <textarea placeholder="Tell us about yourself..." className="bio-input" />
            <button onClick={createProfile} className="connect-btn">Mint Soulbound Profile</button>
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
                  <strong>{m.address}</strong>
                  <div className="match-score">{m.score}% Match Score</div>
                </div>
                <button onClick={() => stakeAndMessage(m.address)} className="action-btn" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
                  Stake & Lick
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
