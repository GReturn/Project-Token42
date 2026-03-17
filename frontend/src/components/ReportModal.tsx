import React from 'react';
import GlassCard from './GlassCard';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: string; // "Slashed" | "Safe" | "Error"
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, status }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <GlassCard style={{ maxWidth: '450px', width: '100%' }}>
            <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
                    {status === 'Slashed' ? '⚖️' : '✅'}
                </div>
                <h2 style={{ marginBottom: '0.5rem', color: '#3A232A' }}>Moderation Result</h2>
                
                {status === 'Slashed' && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <p style={{ color: '#D94A56', fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                            Violation Verified!
                        </p>
                        <p style={{ color: '#8E757E', margin: '1rem 0', lineHeight: 1.5 }}>
                            Your Personal Cupid has reviewed the chat history and confirmed a policy violation.
                        </p>
                        <div style={{ background: 'rgba(235, 76, 76, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(235, 76, 76, 0.2)', textAlign: 'left' }}>
                            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.4, color: '#3A232A' }}>
                                💸 **Behavior Reported:** The reported user's commitment deposit has been confiscated.
                            </p>
                        </div>
                    </div>
                )}

                {status === 'Safe' && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <p style={{ color: '#51cf66', fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                            No Violation Found
                        </p>
                        <p style={{ color: '#8E757E', lineHeight: 1.5 }}>
                            Your Personal Cupid did not find any policy violations in the chat log. No action taken.
                        </p>
                    </div>
                )}

                {status === 'Error' && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <p style={{ color: '#ffb236', fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                            Review Pending
                        </p>
                        <p style={{ color: '#8E757E', lineHeight: 1.5 }}>
                            The report was submitted, but automatic evaluation failed or is taking longer. Admin review triggered.
                        </p>
                    </div>
                )}

                <button className="primary-btn" onClick={onClose} style={{ marginTop: '2rem', width: '100%' }}>
                    Dismiss
                </button>
            </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default ReportModal;
