import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const { copyToClipboard, isCopied, error } = useCopyToClipboard();

  const handleCopy = () => {
    copyToClipboard(text);
  };

  return (
    <button
      onClick={handleCopy}
      className={className}
      style={{
        background: isCopied 
          ? 'linear-gradient(135deg, #00b894, #00a085)'
          : error 
          ? 'linear-gradient(135deg, #e17055, #d63031)'
          : 'linear-gradient(135deg, #667eea, #764ba2)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        padding: '12px 20px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: '120px',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        if (!isCopied && !error) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isCopied && !error) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.2)';
        }
      }}
    >
      {/* Success checkmark */}
      {isCopied && (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{
            animation: 'bounceIn 0.5s ease-out'
          }}>
            <path 
              d="M20 6L9 17L4 12" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          Copied!
        </>
      )}
      
      {/* Error icon */}
      {error && (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
            <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
          </svg>
          Failed
        </>
      )}
      
      {/* Default copy icon */}
      {!isCopied && !error && (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
          </svg>
          Copy Ticket
        </>
      )}

      <style>
        {`
          @keyframes bounceIn {
            0% {
              transform: scale(0.3) rotate(-10deg);
              opacity: 0;
            }
            50% {
              transform: scale(1.1) rotate(5deg);
            }
            100% {
              transform: scale(1) rotate(0deg);
              opacity: 1;
            }
          }
        `}
      </style>
    </button>
  );
}