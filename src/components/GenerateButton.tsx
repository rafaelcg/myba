import { useState, useEffect } from 'react';
import { BUTTON_TEXTS } from '../utils/constants';

interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function GenerateButton({ onClick, disabled = false, loading = false }: GenerateButtonProps) {
  const [buttonTextIndex, setButtonTextIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setButtonTextIndex((prev) => (prev + 1) % BUTTON_TEXTS.length);
    }, 4000); // Change every 4 seconds
    
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: disabled 
          ? 'rgba(255, 255, 255, 0.3)'
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '50px',
        padding: '16px 32px',
        fontSize: '16px',
        fontWeight: '600',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: disabled 
          ? 'none' 
          : '0 4px 15px rgba(102, 126, 234, 0.4)',
        minWidth: '180px',
        position: 'relative',
        overflow: 'hidden',
        ...(loading && {
          background: 'linear-gradient(135deg, #9ca8ea 0%, #a176c2 100%)'
        })
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        }
      }}
    >
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderTop: '2px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Generating...
        </span>
      ) : (
        BUTTON_TEXTS[buttonTextIndex]
      )}
      
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </button>
  );
}