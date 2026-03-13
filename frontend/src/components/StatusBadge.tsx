import React from 'react';

interface StatusBadgeProps {
  status: 'verified' | 'pending' | 'unverified';
  label?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const getColors = () => {
    switch (status) {
      case 'verified': return { bg: 'rgba(0, 255, 204, 0.1)', text: '#00FFCC', border: '#00FFCC' };
      case 'pending': return { bg: 'rgba(255, 204, 0, 0.1)', text: '#FFCC00', border: '#FFCC00' };
      case 'unverified': return { bg: 'rgba(255, 51, 102, 0.1)', text: '#FF3366', border: '#FF3366' };
    }
  };

  const colors = getColors();

  return (
    <span 
      className="status-badge"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap'
      }}
    >
      {label || status}
    </span>
  );
};

export default StatusBadge;
