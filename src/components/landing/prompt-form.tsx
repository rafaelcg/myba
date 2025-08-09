interface PromptFormProps {
  value: string;
  isGenerating: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onGenerate: () => void;
  minChars?: number;
}

export function PromptForm({ value, isGenerating, onChange, onClear, onGenerate, minChars = 10 }: PromptFormProps) {
  const canGenerate = value.trim().length >= minChars && !isGenerating;
  return (
    <div id="prompt-wrap" style={{ padding: '8px 20px' }}>
      <div style={{
        maxWidth: 820,
        margin: '0 auto',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        boxShadow: '0 6px 20px rgba(2,6,23,0.04)'
      }}>
        <div style={{ padding: '20px 20px 16px 20px', borderBottom: '1px solid #eef2f7', color: '#0f172a', fontWeight: 600 }}>
          Describe the task or user story
        </div>
        <div style={{ padding: 20 }}>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={'e.g., As a user, I want to reset my password via email link so I can access my account if I forget it.'}
            disabled={isGenerating}
            style={{
              width: '100%',
              minHeight: 110,
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: 14,
              fontSize: 14,
              lineHeight: 1.5,
              display: 'block',
              resize: 'vertical',
              overflowX: 'hidden'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <span style={{ color: '#64748b', fontSize: 12 }}>
              {value.length > 0 && value.length < minChars
                ? `Add a few more details (${value.length}/${minChars})`
                : 'Tip: Include purpose, constraints, and success criteria for best results.'}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClear}
                disabled={isGenerating}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#0f172a',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
              <button
                onClick={onGenerate}
                disabled={!canGenerate}
                style={{
                  border: '1px solid transparent',
                  background: !canGenerate ? '#10b98180' : '#10b981',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: !canGenerate ? 'not-allowed' : 'pointer'
                }}
              >
                {isGenerating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>
        {`
          @media (min-width: 640px) {
            #prompt-wrap { padding: 16px 20px; }
          }
          @media (min-width: 1024px) {
            #prompt-wrap { padding: 24px 20px; }
          }
        `}
      </style>
    </div>
  )
}


