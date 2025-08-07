// Configuration management for MyBA
export interface AppConfig {
  ai: {
    provider: 'openai' | 'anthropic' | 'mock';
    apiKey?: string;
    model?: string;
  };
  features: {
    enableRealAI: boolean;
    fallbackToMock: boolean;
  };
}

// Default configuration
export const DEFAULT_CONFIG: AppConfig = {
  ai: {
    provider: 'mock', // Start with mock by default for safety
    model: 'gpt-3.5-turbo' // Default OpenAI model
  },
  features: {
    enableRealAI: false, // Disabled by default
    fallbackToMock: true // Always fallback if AI fails
  }
};

// Configuration storage key
const CONFIG_STORAGE_KEY = 'myba-config';

// Load config from localStorage
export function loadConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load config from localStorage:', error);
  }
  return DEFAULT_CONFIG;
}

// Save config to localStorage
export function saveConfig(config: Partial<AppConfig>): void {
  try {
    const current = loadConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save config to localStorage:', error);
  }
}

// Get current configuration
export function getCurrentConfig(): AppConfig {
  return loadConfig();
}

// Check if real AI is configured and enabled
export function isRealAIEnabled(): boolean {
  const config = loadConfig();
  return config.features.enableRealAI && !!config.ai.apiKey;
}

// Validate API key format
export function validateApiKey(provider: string, apiKey: string): boolean {
  if (!apiKey || apiKey.trim().length === 0) return false;
  
  switch (provider) {
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length > 20;
    case 'anthropic':
      return apiKey.startsWith('sk-ant-') && apiKey.length > 30;
    default:
      return false;
  }
}