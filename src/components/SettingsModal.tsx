import { useState, useEffect } from 'react';
import { getCurrentConfig, saveConfig, validateApiKey, AppConfig } from '../utils/config';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: (config: AppConfig) => void;
}

export function SettingsModal({ isOpen, onClose, onConfigChange }: SettingsModalProps) {
  const [config, setConfig] = useState(getCurrentConfig());
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const currentConfig = getCurrentConfig();
      setConfig(currentConfig);
      setApiKey(currentConfig.ai.apiKey || '');
      setErrors([]);
    }
  }, [isOpen]);

  const handleSave = () => {
    const newErrors: string[] = [];

    // Validate API key if real AI is enabled
    if (config.features.enableRealAI) {
      if (!apiKey.trim()) {
        newErrors.push('API key is required when real AI is enabled');
      } else if (!validateApiKey(config.ai.provider, apiKey)) {
        newErrors.push(`Invalid ${config.ai.provider.toUpperCase()} API key format`);
      }
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    // Save configuration
    const updatedConfig = {
      ...config,
      ai: {
        ...config.ai,
        apiKey: config.features.enableRealAI ? apiKey : undefined
      }
    };

    saveConfig(updatedConfig);
    onConfigChange(updatedConfig);
    onClose();
  };

  const handleProviderChange = (provider: 'openai' | 'anthropic') => {
    setConfig(prev => ({
      ...prev,
      ai: {
        ...prev.ai,
        provider,
        model: provider === 'openai' ? 'gpt-3.5-turbo' : 'claude-3-haiku-20240307'
      }
    }));
    setApiKey(''); // Clear API key when switching providers
    setErrors([]);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      zIndex: 1000,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        animation: 'slideUp 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <h2 style={{
            color: '#2c3e50',
            fontSize: '24px',
            fontWeight: '600',
            margin: 0
          }}>
            ⚙️ AI Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#95a5a6',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Service Options Explanation */}
        <div style={{ 
          background: '#f8f9fa',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <h4 style={{
            color: '#2c3e50',
            fontSize: '14px',
            fontWeight: '600',
            margin: '0 0 8px 0'
          }}>
            🎫 Token-Based Service (Recommended)
          </h4>
          <p style={{
            fontSize: '12px',
            color: '#7f8c8d',
            margin: '0 0 12px 0'
          }}>
            Use our AI service with tokens. No API key needed, simple pay-per-use pricing.
          </p>
          <div style={{
            fontSize: '12px',
            color: '#27ae60',
            fontWeight: '500'
          }}>
            ✓ No setup required ✓ Secure ✓ Fair pricing ✓ 3 free tokens
          </div>
        </div>

        {/* AI Provider Selection */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#2c3e50',
            marginBottom: '8px'
          }}>
            AI Provider
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            {(['openai', 'anthropic'] as const).map(provider => (
              <button
                key={provider}
                onClick={() => handleProviderChange(provider)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: '2px solid',
                  borderColor: config.ai.provider === provider ? '#667eea' : '#e9ecef',
                  borderRadius: '8px',
                  background: config.ai.provider === provider ? '#f8f9ff' : 'white',
                  color: config.ai.provider === provider ? '#667eea' : '#7f8c8d',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
              >
                {provider === 'openai' ? '🤖 OpenAI' : '🧠 Anthropic'}
              </button>
            ))}
          </div>
        </div>

        {/* Enable User's Own AI Toggle */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={config.features.enableRealAI}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                features: { ...prev.features, enableRealAI: e.target.checked }
              }))}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Use Your Own API Key
            </span>
          </label>
          <p style={{
            fontSize: '12px',
            color: '#7f8c8d',
            margin: '4px 0 0 30px'
          }}>
            Use your own AI API key instead of our token-based service. Perfect if you have unlimited API access.
          </p>
        </div>

        {/* API Key Input */}
        {config.features.enableRealAI && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '8px'
            }}>
              {config.ai.provider.toUpperCase()} API Key
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${config.ai.provider.toUpperCase()} API key...`}
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 12px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'Monaco, monospace',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#7f8c8d'
                }}
              >
                {showApiKey ? '🙈' : '👁️'}
              </button>
            </div>
            <p style={{
              fontSize: '12px',
              color: '#7f8c8d',
              margin: '4px 0 0 0'
            }}>
              Your API key is stored locally and never sent to our servers.
            </p>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div style={{
            background: '#ffe6e6',
            border: '1px solid #ff9999',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '24px'
          }}>
            {errors.map((error, index) => (
              <p key={index} style={{
                color: '#cc0000',
                fontSize: '14px',
                margin: 0,
                marginBottom: index < errors.length - 1 ? '4px' : 0
              }}>
                ❌ {error}
              </p>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              border: '2px solid #e9ecef',
              borderRadius: '8px',
              background: 'white',
              color: '#7f8c8d',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Save Settings
          </button>
        </div>

        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}
        </style>
      </div>
    </div>
  );
}