import { useState, useEffect } from 'react';
import { LOADING_MESSAGES } from '../utils/constants';

interface LoadingSpinnerProps {
  message?: string;
  variant?: 'onDark' | 'onLight';
}

export function LoadingSpinner({ message, variant = 'onDark' }: LoadingSpinnerProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000); // Change every 2 seconds
    
    return () => clearInterval(interval);
  }, []);

  const currentMessage = message || LOADING_MESSAGES[messageIndex];
  const isOnLight = variant === 'onLight';
  const messageColor = isOnLight ? '#334155' : 'rgba(255, 255, 255, 0.9)';
  const dotColor = isOnLight ? 'rgba(15,23,42,0.45)' : 'rgba(255, 255, 255, 0.6)';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      padding: '40px',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      {/* Spinning circles */}
      <div style={{
        position: 'relative',
        width: '60px',
        height: '60px'
      }}>
        {/* Outer ring */}
        <div style={{
          position: 'absolute',
          width: '60px',
          height: '60px',
          border: '3px solid rgba(102, 126, 234, 0.2)',
          borderTop: '3px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1.2s linear infinite'
        }} />
        
        {/* Inner ring */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          width: '40px',
          height: '40px',
          border: '2px solid rgba(118, 75, 162, 0.2)',
          borderTop: '2px solid #764ba2',
          borderRadius: '50%',
          animation: 'spinReverse 0.8s linear infinite'
        }} />
        
        {/* Center dot */}
        <div style={{
          position: 'absolute',
          top: '25px',
          left: '25px',
          width: '10px',
          height: '10px',
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          borderRadius: '50%',
          animation: 'pulse 1.5s ease-in-out infinite'
        }} />
      </div>
      
      {/* Loading message */}
      <div style={{
        textAlign: 'center',
        color: messageColor,
        fontSize: '16px',
        fontWeight: '500',
        minHeight: '20px',
        animation: 'messageSlide 0.4s ease-out'
      }}>
        {currentMessage}
      </div>
      
      {/* Progress dots */}
      <div style={{
        display: 'flex',
        gap: '6px',
        alignItems: 'center'
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              background: dotColor,
              borderRadius: '50%',
              animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`
            }}
          />
        ))}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes spinReverse {
            0% { transform: rotate(360deg); }
            100% { transform: rotate(0deg); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(0.8); }
          }
          
          @keyframes bounce {
            0%, 80%, 100% { 
              transform: scale(0);
              opacity: 0.5;
            }
            40% { 
              transform: scale(1);
              opacity: 1;
            }
          }
          
          @keyframes messageSlide {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
}