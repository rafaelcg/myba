import { GeneratedTicket } from './mockAI';
import { analyzeInput, buildEnhancedPrompt } from './promptEngine';

// OpenRouter configuration
const OPENROUTER_API_KEY = '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';
const OPENROUTER_MODEL = 'openai/gpt-oss-20b:free';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface OpenRouterConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
}

const DEFAULT_CONFIG: OpenRouterConfig = {
  model: OPENROUTER_MODEL,
  maxTokens: 2000,
  temperature: 0.3,
  apiKey: OPENROUTER_API_KEY
};

export class OpenRouterService {
  constructor(private config: OpenRouterConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async generateTicket(input: string): Promise<GeneratedTicket> {
    const apiKey = this.config.apiKey || OPENROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    // Analyze input for better prompt engineering
    const context = analyzeInput(input);
    const prompt = buildEnhancedPrompt(input, context);
    
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin, // Required by OpenRouter
          'X-Title': 'MyBA - AI Ticket Generator' // Optional but good for tracking
        },
        body: JSON.stringify({
          model: this.config.model || OPENROUTER_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are an expert product manager and technical writer. Create professional, detailed tickets for software development teams. 

Key guidelines:
- Use clear, actionable language
- Include proper markdown formatting with emojis
- Structure tickets with summary, acceptance criteria, and technical notes
- Tailor content based on ticket type (bug, feature, epic, task, improvement)
- Make tickets ready for Jira, GitLab, or similar platforms
- Be concise but comprehensive`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens || 2000,
          temperature: this.config.temperature || 0.3,
          stream: false
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown API error' } }));
        
        if (response.status === 401) {
          throw new Error('OpenRouter authentication failed. Please check API configuration.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        } else if (response.status === 402) {
          throw new Error('Insufficient credits on OpenRouter account.');
        } else if (response.status === 400) {
          throw new Error('Invalid request format. Please try again.');
        }
        
        throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      // Check for OpenRouter-specific error format
      if (data.error) {
        throw new Error(`OpenRouter error: ${data.error.message || 'Unknown error'}`);
      }
      
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content generated from OpenRouter');
      }

      return this.parseResponse(content, input, context.ticketType);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to generate ticket with OpenRouter AI');
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

  // Test API connectivity
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey || OPENROUTER_API_KEY}`,
          'HTTP-Referer': window.location.origin
        }
      });
      
      return response.ok;
    } catch (error) {
      console.warn('OpenRouter connection test failed:', error);
      return false;
    }
  }

  // Get available models (for future expansion)
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey || OPENROUTER_API_KEY}`,
          'HTTP-Referer': window.location.origin
        }
      });
      
      if (!response.ok) {
        return [OPENROUTER_MODEL]; // Fallback to default
      }
      
      const data = await response.json();
      return data.data?.map((model: any) => model.id) || [OPENROUTER_MODEL];
    } catch (error) {
      console.warn('Failed to fetch available models:', error);
      return [OPENROUTER_MODEL];
    }
  }
}

// Singleton instance
let openRouterService: OpenRouterService | null = null;

export function getOpenRouterService(config?: OpenRouterConfig): OpenRouterService {
  if (!openRouterService || config) {
    openRouterService = new OpenRouterService(config);
  }
  return openRouterService;
}

// Helper function for easy integration
export async function generateTicketWithOpenRouter(input: string, config?: OpenRouterConfig): Promise<GeneratedTicket> {
  const service = getOpenRouterService(config);
  return service.generateTicket(input);
}