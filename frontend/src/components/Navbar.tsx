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
        <span>Token42</span>
      </div>
      
      {address && (
        <div className="nav-links">
          <button 
            className={step === 'matching' ? 'active' : ''} 
            onClick={() => setStep('matching')}
          >
            Discovery
          </button>
          <button 
            className={step === 'chat' ? 'active' : ''} 
            onClick={() => setStep('chat')}
          >
            Messages
          </button>
          <button 
            className={step === 'profile' ? 'active' : ''} 
            onClick={() => setStep('profile')}
          >
            Profile
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
