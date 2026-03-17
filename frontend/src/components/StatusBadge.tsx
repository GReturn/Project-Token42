import React from 'react';

interface StatusBadgeProps {
  status: 'verified' | 'pending' | 'unverified';
  label?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const getTailwindClasses = () => {
    switch (status) {
      case 'verified': return 'bg-[#D94A56]/10 text-[#D94A56] border-[#D94A56]/20';
      case 'pending': return 'bg-[#FFB54C]/10 text-[#FFB54C] border-[#FFB54C]/20';
      case 'unverified': return 'bg-black/5 text-[#8E757E] border-black/10';
    }
  };

  return (
    <span 
      className={`inline-block py-0.5 px-2 rounded-xl text-[0.7rem] font-bold uppercase tracking-wide border whitespace-nowrap ${getTailwindClasses()}`}
    >
      {label || status}
    </span>
  );
};

export default StatusBadge;
