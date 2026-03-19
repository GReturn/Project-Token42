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
  onProposeDate?: () => Promise<void>;
}

const PoRLModal: React.FC<PoRLModalProps> = ({ 
  address, 
  partner, 
  status, 
  onClose, 
  onSubmitProof,
  onAcceptDate,
  onCancelDate,
  onResolveExpired,
  onProposeDate
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [mySignature, setMySignature] = useState<string | null>(null);

  // Generate my signature for the partner to scan
  // Sign: dateId + partnerAddress
  useEffect(() => {
    const signPayload = async () => {
      // Only sign if we are in an Active date (status 2) and haven't signed yet
      if (status && status.status === 2 && status.id && (window as any).ethereum && !mySignature) {
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const signer = await provider.getSigner();
          const message = ethers.solidityPackedKeccak256(["bytes32", "address"], [status.id, partner]);
          const sig = await signer.signMessage(ethers.toBeArray(message));
          setMySignature(sig);
        } catch (e) {
          console.error("Signing failed:", e);
        }
      }
    };
    signPayload();
  }, [status?.id, status?.status, partner, mySignature]);

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
            <h2 style={{ margin: 0, color: '#3A232A' }}>Verify Authenticity</h2>
            {getStatusLabel(status.status)}
          </div>

          {status.status === 0 && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤝</div>
              <p style={{ color: '#8E757E', marginBottom: '1.5rem' }}>
                Ready to take it to the real world?
              </p>
              <div style={{ background: 'rgba(235, 76, 76, 0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'left', border: '1px solid rgba(217,74,86,0.1)' }}>
                <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: '1.4', color: '#3A232A' }}>
                  💡 **Asking them out** locks 10 rUSD in secure escrow. 
                  It shows genuine intent and is safely returned to you upon successful meetup verification.
                </p>
              </div>
              {onProposeDate && (
                <button className="primary-btn" onClick={onProposeDate} style={{ width: '100%' }}>
                  Ask Them Out (Stake 10 rUSD)
                </button>
              )}
            </div>
          )}

          {status.status === 1 && !isUserB && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#8E757E' }}>
                Waiting for {partner.slice(0, 6)}... to respond to your invitation.
              </p>
              <button className="secondary-btn" onClick={() => onCancelDate(partner)} style={{ marginTop: '1rem', width: '100%' }}>Cancel Request</button>
            </div>
          )}

          {canAccept && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: '1.5rem', color: '#3A232A' }}>You've been invited to a date! Stake 10 rUSD to confirm your interest.</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button className="primary-btn" onClick={onAcceptDate}>Accept & Stake</button>
                <button className="secondary-btn" onClick={() => onCancelDate(partner)}>Cancel</button>
              </div>
            </div>
          )}

          {status.status === 2 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: '#8E757E' }}>
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
                <p style={{ color: '#D94A56', fontSize: '0.85rem', marginTop: '1rem', fontWeight: 600 }}>
                  ✓ Code scanned! Waiting for partner.
                </p>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
                <button className="secondary-btn" onClick={() => onCancelDate(partner)} style={{ fontSize: '0.85rem' }}>Cancel Date</button>
                {Date.now() / 1000 > Number(status.startTime) + 24 * 3600 && (
                   <button className="primary-btn" onClick={() => onResolveExpired(partner)} style={{ fontSize: '0.85rem', background: '#D94A56' }}>Settle Timeout</button>
                )}
              </div>
            </div>
          )}

          {status.status >= 3 && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {status.status === 3 ? '🎉' : '❌'}
              </div>
              <p style={{ color: '#3A232A' }}>{status.status === 3 ? 'Authenticity Verified! Deposits safely returned.' : 'Date resolved with issues.'}</p>
              <button className="secondary-btn" onClick={onClose} style={{ marginTop: '1rem' }}>Close</button>
            </div>
          )}

          {status.status !== 2 && status.status !== 1 && (
             <button className="text-btn" onClick={onClose} style={{ display: 'block', margin: '1rem auto 0', textDecoration: 'none' }}>
               Back to Chat
             </button>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default PoRLModal;
