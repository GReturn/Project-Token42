import React from 'react';

interface NavbarProps {
  address: string | null;
  step: string;
  setStep: (step: any) => void;
}

const Navbar: React.FC<NavbarProps> = ({ address, step, setStep }) => {
  return (
    <nav className="navbar">
      <div className="nav-logo">
        <img src="/token42.svg" alt="Token42" />
        <span className="logo-text">Token42</span>
      </div>
      
      {address && (
        <div className="nav-links">
          <button 
            className={step === 'profile' ? 'active' : ''} 
            onClick={() => setStep('profile')}
          >
            <svg className="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span className="nav-text">Profile</span>
          </button>
          <button 
            className={step === 'matching' ? 'active' : ''} 
            onClick={() => setStep('matching')}
          >
            <svg className="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
            <span className="nav-text">Discovery</span>
          </button>
          <button 
            className={step === 'chat' ? 'active' : ''} 
            onClick={() => setStep('chat')}
          >
            <svg className="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            <span className="nav-text">Messages</span>
          </button>
        </div>
      )}

      {address && (
        <div className="nav-user">
          <span className="address-pill">{address.slice(0, 6)}...{address.slice(-4)}</span>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
