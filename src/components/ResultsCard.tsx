import { CopyButton } from './CopyButton';

interface ResultsCardProps {
  title: string;
  content: string;
  onStartOver: () => void;
}

export function ResultsCard({ title, content, onStartOver }: ResultsCardProps) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '16px',
      padding: '24px',
      maxWidth: '800px',
      width: '100%',
      margin: '0 auto',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
      backdropFilter: 'blur(10px)',
      animation: 'slideUp 0.6s ease-out'
    }}>
      {/* Header with success message */}
      <div style={{
        textAlign: 'center',
        marginBottom: '24px',
        animation: 'fadeIn 0.8s ease-out 0.2s both'
      }}>
        <div style={{
          fontSize: '24px',
          marginBottom: '8px'
        }}>
          ✨
        </div>
        <h2 style={{
          color: '#2c3e50',
          fontSize: '20px',
          fontWeight: '600',
          margin: '0 0 8px 0'
        }}>
          {title}
        </h2>
        <p style={{
          color: '#7f8c8d',
          fontSize: '14px',
          margin: '0'
        }}>
          Ready to paste into Jira, Linear, or Asana.
        </p>
      </div>

      {/* Ticket content */}
      <div style={{
        background: '#f8f9fa',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid #e9ecef',
        fontFamily: 'Monaco, "Lucida Console", "Courier New", monospace',
        fontSize: '14px',
        lineHeight: '1.6',
        color: '#2c3e50',
        whiteSpace: 'pre-wrap',
        maxHeight: '400px',
        overflowY: 'auto',
        animation: 'fadeIn 0.6s ease-out 0.4s both'
      }}>
        {content}
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
        flexWrap: 'wrap',
        animation: 'fadeIn 0.6s ease-out 0.6s both'
      }}>
        <CopyButton text={content} />
        
        <button
          onClick={onStartOver}
          style={{
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
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
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path 
              d="M3 12h18m-9-9l9 9-9 9" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              transform="rotate(180 12 12)"
            />
          </svg>
          Create another ticket
        </button>
      </div>

      <style>
        {`
          @keyframes slideUp {
            from { 
              opacity: 0; 
              transform: translateY(40px); 
            }
            to { 
              opacity: 1; 
              transform: translateY(0); 
            }
          }
          
          @keyframes fadeIn {
            from { 
              opacity: 0; 
              transform: translateY(20px); 
            }
            to { 
              opacity: 1; 
              transform: translateY(0); 
            }
          }
        `}
      </style>
    </div>
  );
}