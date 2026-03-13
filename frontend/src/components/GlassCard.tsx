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
      className={`glass-card ${className}`} 
      onClick={onClick}
      style={{ ...style, cursor: onClick ? 'pointer' : 'default' }}
    >
      {children}
    </div>
  );
};

export default GlassCard;
