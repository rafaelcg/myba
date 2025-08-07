import { useState, useEffect } from 'react';
import { PLACEHOLDER_TEXTS } from '../utils/constants';

interface InputFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function InputField({ value, onChange, disabled = false }: InputFieldProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_TEXTS.length);
    }, 3000); // Change every 3 seconds
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      width: '100%',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={PLACEHOLDER_TEXTS[placeholderIndex]}
        style={{
          width: '100%',
          minHeight: '120px',
          padding: '20px',
          fontSize: '16px',
          lineHeight: '1.5',
          border: 'none',
          borderRadius: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          resize: 'vertical',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          transition: 'all 0.3s ease',
          outline: 'none',
          backdropFilter: 'blur(10px)',
          ...(disabled && {
            opacity: 0.7,
            cursor: 'not-allowed'
          })
        }}
        onFocus={(e) => {
          e.target.style.boxShadow = '0 8px 30px rgba(102, 126, 234, 0.15)';
          e.target.style.transform = 'translateY(-2px)';
        }}
        onBlur={(e) => {
          e.target.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
          e.target.style.transform = 'translateY(0)';
        }}
      />
      
      {/* Character count */}
      <div style={{
        marginTop: '8px',
        textAlign: 'right',
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '500'
      }}>
        {value.length > 0 && `${value.length} characters`}
      </div>
    </div>
  );
}