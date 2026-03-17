import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', style, onClick }) => {
  return (
    <div 
      className={`bg-white/60 backdrop-blur-[20px] border border-white/50 rounded-[24px] p-8 shadow-[0_8px_32px_rgba(217,74,86,0.08)] transition-all duration-300 hover:border-white/70 hover:shadow-[0_12px_40px_rgba(217,74,86,0.15)] ${className}`} 
      onClick={onClick}
      style={{ ...style, cursor: onClick ? 'pointer' : 'default' }}
    >
      {children}
    </div>
  );
};

export default GlassCard;
