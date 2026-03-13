import React from 'react';
import './Loading.css';

interface LoadingProps {
  message?: string;
}

const Loading: React.FC<LoadingProps> = ({ message = "Loading..." }) => {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="logo-container">
          <img src="/token42.svg" alt="Token42 Logo" className="loading-logo" />
          <div className="glow-ring"></div>
        </div>
        <div className="loading-status">
          <h3 className="loading-message">{message}</h3>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Loading;
