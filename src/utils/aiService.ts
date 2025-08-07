import { GeneratedTicket } from './mockAI';
import { analyzeInput, buildEnhancedPrompt } from './promptEngine';

// AI Service Configuration
export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'mock';
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

// Default configuration
const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai', // Can be changed to 'anthropic' or 'mock'
  model: 'gpt-3.5-turbo',
  maxTokens: 2000, // Increased for more detailed tickets
  temperature: 0.3 // Lower for more consistent, professional output
};

// AI Service Interface
export interface AIService {
  generateTicket(input: string): Promise<GeneratedTicket>;
}

// OpenAI Service Implementation
class OpenAIService implements AIService {
  constructor(private config: AIConfig) {}

  async generateTicket(input: string): Promise<GeneratedTicket> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please add your API key in settings.');
    }

    // Analyze input for better prompt engineering
    const context = analyzeInput(input);
    const prompt = buildEnhancedPrompt(input, context);
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a senior product manager and technical writer who creates exceptional, detailed tickets for software development teams. You understand different ticket types (bugs, features, epics, tasks, improvements) and tailor your responses accordingly. Always use professional language with clear structure and actionable details.`
            },
            {
              role: 'user', 
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens || 2000,
          temperature: this.config.temperature || 0.3
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown API error' } }));
        
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your OpenAI API key in settings.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        } else if (response.status === 403) {
          throw new Error('API access forbidden. Please check your OpenAI account status.');
        }
        
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content generated from OpenAI');
      }

      return this.parseResponse(content, input, context.ticketType);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to generate ticket with OpenAI');
    }
  }

  private parseResponse(content: string, originalInput: string, ticketType: string): GeneratedTicket {
    // Extract title from the first heading or generate one
    const titleMatch = content.match(/^#{1,2}\s+(.+)$/m);
    let title = '';
    
    if (titleMatch) {
      title = titleMatch[1]
        .replace(/🎯|Epic:|Feature:|Bug:|Task:|Improvement:|🐛|✨|📋|⚡|🔧/g, '')
        .trim();
    } else {
      // Generate title from input if none found
      title = this.generateTitleFromInput(originalInput, ticketType);
    }
    
    return {
      title,
      content: content.trim()
    };
  }

  private generateTitleFromInput(input: string, ticketType: string): string {
    const words = input.split(' ').slice(0, 8);
    let title = words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    
    // Add type prefix for clarity
    const prefixes = {
      bug: '🐛 Fix: ',
      feature: '✨ Add: ',
      epic: '🎯 Epic: ',
      improvement: '⚡ Improve: ',
      task: '📋 Task: '
    };
    
    return (prefixes[ticketType as keyof typeof prefixes] || '') + title;
  }
}

// Anthropic Service Implementation
class AnthropicService implements AIService {
  constructor(private config: AIConfig) {}

  async generateTicket(input: string): Promise<GeneratedTicket> {
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('Anthropic API key not configured. Please add your API key in settings.');
    }

    // Analyze input for better prompt engineering
    const context = analyzeInput(input);
    const prompt = buildEnhancedPrompt(input, context);
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-3-haiku-20240307',
          max_tokens: this.config.maxTokens || 2000,
          temperature: this.config.temperature || 0.3,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown API error' } }));
        
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your Anthropic API key in settings.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.content[0]?.text;
      
      if (!content) {
        throw new Error('No content generated from Anthropic');
      }

      return this.parseResponse(content, input, context.ticketType);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to generate ticket with Anthropic');
    }
  }

  private parseResponse(content: string, originalInput: string, ticketType: string): GeneratedTicket {
    const titleMatch = content.match(/^#{1,2}\s+(.+)$/m);
    let title = '';
    
    if (titleMatch) {
      title = titleMatch[1]
        .replace(/🎯|Epic:|Feature:|Bug:|Task:|Improvement:|🐛|✨|📋|⚡|🔧/g, '')
        .trim();
    } else {
      title = this.generateTitleFromInput(originalInput, ticketType);
    }
    
    return {
      title,
      content: content.trim()
    };
  }

  private generateTitleFromInput(input: string, ticketType: string): string {
    const words = input.split(' ').slice(0, 8);
    let title = words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    
    const prefixes = {
      bug: '🐛 Fix: ',
      feature: '✨ Add: ',
      epic: '🎯 Epic: ',
      improvement: '⚡ Improve: ',
      task: '📋 Task: '
    };
    
    return (prefixes[ticketType as keyof typeof prefixes] || '') + title;
  }
}

// Mock Service (fallback)
class MockAIService implements AIService {
  async generateTicket(input: string): Promise<GeneratedTicket> {
    // Import and use the existing mock service
    const { generateTicket } = await import('./mockAI');
    return generateTicket(input);
  }
}

// AI Service Factory
export class AIServiceFactory {
  static create(config: Partial<AIConfig> = {}): AIService {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    switch (finalConfig.provider) {
      case 'openai':
        return new OpenAIService(finalConfig);
      case 'anthropic':
        return new AnthropicService(finalConfig);
      case 'mock':
      default:
        return new MockAIService();
    }
  }
}

// Main AI Service Instance
let aiService: AIService;

export function getAIService(config?: Partial<AIConfig>): AIService {
  if (!aiService || config) {
    aiService = AIServiceFactory.create(config);
  }
  return aiService;
}

// Helper function for easy integration with enhanced error handling
export async function generateTicketWithAI(input: string, config?: Partial<AIConfig>): Promise<GeneratedTicket> {
  const service = getAIService(config);
  
  try {
    return await service.generateTicket(input);
  } catch (error) {
    // Enhanced error handling with specific messages
    let errorMessage = 'Failed to generate ticket';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // If it's an API key or auth error, don't fallback to mock
      if (errorMessage.includes('API key') || errorMessage.includes('Invalid') || errorMessage.includes('forbidden')) {
        throw error;
      }
    }
    
    console.warn('AI service failed, falling back to mock:', error);
    
    // Fallback to mock service for other errors
    const mockService = new MockAIService();
    const mockResult = await mockService.generateTicket(input);
    
    // Add a note that this is a fallback
    return {
      ...mockResult,
      content: `> **Note**: AI service temporarily unavailable, showing sample template.\n\n${mockResult.content}`
    };
  }
}