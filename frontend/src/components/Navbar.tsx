import React from 'react';

interface NavbarProps {
  address: string | null;
  step: string;
  setStep: (step: any) => void;
}

const Navbar: React.FC<NavbarProps> = ({ address, step, setStep }) => {
  return (
    <nav className="h-20 flex justify-between items-center px-8 bg-brand-dark/95 backdrop-blur-md border-b border-white/5 sticky top-0 z-[100]">
      {/* Left Menu / Logo */}
      <div className="flex items-center w-1/3">
        <img src="/token42.svg" alt="Token42 Logo" className="h-10 w-auto" />
      </div>
      
      {/* Center Navbar Tabs */}
      {address && (
        <div className="flex justify-center flex-1 sm:w-1/3">
          <div className="flex gap-2 bg-black/20 p-1.5 rounded-full border border-white/5">
            <button 
              className={`bg-none border-none font-bold text-xl cursor-pointer py-2.5 px-8 rounded-full transition-all duration-200 flex items-center group ${step === 'matching' ? 'text-brand-red bg-brand-red/10' : 'text-brand-light/60 hover:text-brand-light hover:bg-white/5'}`} 
              onClick={() => setStep('matching')}
            >
              <span>Discovery</span>
            </button>
            <button 
              className={`bg-none border-none font-bold text-xl cursor-pointer py-2.5 px-8 rounded-full transition-all duration-200 flex items-center group ${step === 'chat' ? 'text-brand-red bg-brand-red/10' : 'text-brand-light/60 hover:text-brand-light hover:bg-white/5'}`} 
              onClick={() => setStep('chat')}
            >
              <span>Messages</span>
            </button>
          </div>
        </div>
      )}

      {/* Right Menu (Profile & Address) */}
      <div className="flex items-center justify-end gap-3 w-1/3">
        {address && (
          <>
            <span className="bg-white/5 py-1.5 px-3.5 rounded-full border border-white/10 font-mono text-sm font-medium text-brand-light/60 hidden md:inline-block">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            <button 
              className={`bg-none border-none cursor-pointer p-1 rounded-full transition-all duration-200 flex items-center group ${step === 'profile' ? 'ring-2 ring-brand-red ring-offset-2 ring-offset-brand-dark' : 'hover:bg-white/5'}`} 
              onClick={() => setStep('profile')}
              title="Setup Profile"
            >
              <img 
                src="https://placehold.co/48x48/ff8374/0c0c0b?text=SP" 
                alt="Setup Profile" 
                className="w-12 h-12 rounded-full border border-white/10"
              />
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
