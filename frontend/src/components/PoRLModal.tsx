import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ethers } from 'ethers';
import GlassCard from './GlassCard';

interface PoRLModalProps {
  address: string;
  partner: string;
  status: any;
  onClose: () => void;
  onSubmitProof: (signature: string) => Promise<void>;
  onAcceptDate: () => Promise<void>;
  onCancelDate: (partner: string) => Promise<void>;
  onResolveExpired: (partner: string) => Promise<void>;
}

const PoRLModal: React.FC<PoRLModalProps> = ({ 
  address, 
  partner, 
  status, 
  onClose, 
  onSubmitProof,
  onAcceptDate,
  onCancelDate,
  onResolveExpired
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [mySignature, setMySignature] = useState<string | null>(null);

  // Generate my signature for the partner to scan
  // Sign: dateId + partnerAddress
  useEffect(() => {
    const signPayload = async () => {
      if (status && status.id && (window as any).ethereum) {
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const signer = await provider.getSigner();
          const message = ethers.solidityPackedKeccak256(["bytes32", "address"], [status.id, address]);
          const sig = await signer.signMessage(ethers.toBeArray(message));
          setMySignature(sig);
        } catch (e) {
          console.error("Signing failed:", e);
        }
      }
    };
    signPayload();
  }, [status, address]);

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        scanner.clear();
        setIsScanning(false);
        onSubmitProof(decodedText);
      }, (error) => {
        // console.warn(error);
      });
    }, 100);
  };

  if (!status) return null;

  const getStatusLabel = (s: number) => {
    switch(s) {
      case 1: return <span className="date-status-badge status-proposed">Proposed</span>;
      case 2: return <span className="date-status-badge status-active">Active</span>;
      case 3: return <span className="date-status-badge status-resolved">Success</span>;
      case 4: return <span className="date-status-badge status-slashed">Slashed</span>;
      case 5: return <span className="date-status-badge status-cancelled">Cancelled</span>;
      default: return null;
    }
  };

  const isUserB = status.userB.toLowerCase() === address.toLowerCase();
  const canAccept = status.status === 1 && isUserB;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <GlassCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>Date Verification</h2>
            {getStatusLabel(status.status)}
          </div>

          {status.status === 1 && !isUserB && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>
                Waiting for {partner.slice(0, 6)}... to accept the date.
              </p>
              <button className="secondary-btn" onClick={() => onCancelDate(partner)} style={{ marginTop: '1rem', width: '100%' }}>Cancel Request</button>
            </div>
          )}

          {canAccept && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: '1.5rem' }}>You've been invited to a date! Stake 10 rUSD to confirm.</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button className="primary-btn" onClick={onAcceptDate}>Accept & Stake</button>
                <button className="secondary-btn" onClick={() => onCancelDate(partner)}>Cancel</button>
              </div>
            </div>
          )}

          {status.status === 2 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Meeting in person? Exchange QR codes to verify.
              </p>
              
              <div style={{ margin: '1.5rem 0' }}>
                <p className="input-label">Show this to partner:</p>
                <div className="qr-container">
                  {mySignature ? (
                    <QRCodeSVG value={mySignature} size={200} />
                  ) : (
                    <div style={{ height: 200, display: 'flex', alignItems: 'center' }}>Signing...</div>
                  )}
                </div>
              </div>

              {!isScanning ? (
                <button className="secondary-btn" onClick={startScanner}>
                   Scan Partner's Code
                </button>
              ) : (
                <div id="reader" className="qr-scanner-container"></div>
              )}

              {( (status.userA.toLowerCase() === address.toLowerCase() && status.proofA) || 
                 (status.userB.toLowerCase() === address.toLowerCase() && status.proofB) ) && (
                <p style={{ color: 'var(--accent)', fontSize: '0.85rem', marginTop: '1rem' }}>
                  ✓ Your proof submitted! Waiting for partner.
                </p>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button className="secondary-btn" onClick={() => onCancelDate(partner)} style={{ fontSize: '0.85rem' }}>Cancel Date</button>
                {Date.now() / 1000 > Number(status.startTime) + 24 * 3600 && (
                   <button className="primary-btn" onClick={() => onResolveExpired(partner)} style={{ fontSize: '0.85rem', background: '#FF3366' }}>Settle Timeout</button>
                )}
              </div>
            </div>
          )}

          {status.status >= 3 && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {status.status === 3 ? '🎉' : '❌'}
              </div>
              <p>{status.status === 3 ? 'Date Verified! Treasury fee paid and stakes returned.' : 'Date resolved with issues.'}</p>
              <button className="secondary-btn" onClick={onClose} style={{ marginTop: '1rem' }}>Close</button>
            </div>
          )}

          {status.status !== 2 && status.status !== 1 && (
             <button className="text-btn" onClick={onClose} style={{ display: 'block', margin: '1rem auto 0' }}>
               Back to Chat
             </button>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default PoRLModal;
