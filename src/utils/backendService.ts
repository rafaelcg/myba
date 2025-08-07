import { GeneratedTicket } from './mockAI';
import { analyzeInput, buildEnhancedPrompt } from './promptEngine';
import { hasTokens, consumeTokens, TOKEN_COSTS } from './tokenSystem';

// Backend API Configuration
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001/api' 
  : `${window.location.protocol}//${window.location.hostname}/myba/api`;

// Backend AI Service
export class BackendAIService {
  async generateTicket(input: string): Promise<GeneratedTicket> {
    // Check if user has enough tokens
    if (!hasTokens(TOKEN_COSTS.GENERATE_TICKET)) {
      throw new Error('Insufficient tokens. Please purchase more tokens to continue generating tickets.');
    }

    // Analyze input for better prompt engineering
    const context = analyzeInput(input);
    const prompt = buildEnhancedPrompt(input, context);

    try {
      // Make request to our backend API
      const response = await fetch(`${API_BASE_URL}/generate-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          tokensUsed: TOKEN_COSTS.GENERATE_TICKET
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        
        if (response.status === 429) {
          throw new Error('Service is currently busy. Please try again in a moment.');
        } else if (response.status >= 500) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
        
        throw new Error(errorData.error || 'Failed to generate ticket');
      }

      const data = await response.json();
      
      if (!data.content) {
        throw new Error('No content generated');
      }

      // Consume tokens only after successful generation
      if (!consumeTokens(TOKEN_COSTS.GENERATE_TICKET)) {
        console.warn('Failed to consume tokens after successful generation');
      }

      return this.parseResponse(data.content, input, context.ticketType);

    } catch (error) {
      if (error instanceof Error) {
        // Don't consume tokens on error
        throw error;
      }
      throw new Error('Failed to generate ticket');
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

// Health check function
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// Token-aware AI generation function
export async function generateTicketWithBackend(input: string): Promise<GeneratedTicket> {
  const service = new BackendAIService();
  
  try {
    return await service.generateTicket(input);
  } catch (error) {
    // Enhanced error handling
    if (error instanceof Error) {
      
      // If it's a token-related error, show specific message
      if (error.message.includes('Insufficient tokens')) {
        throw error;
      }
      
      // If it's a service error, try to provide helpful guidance
      if (error.message.includes('Service') || error.message.includes('Network')) {
        throw new Error(`${error.message} Our AI service might be temporarily unavailable.`);
      }
    }
    
    console.warn('Backend AI service failed, falling back to mock:', error);
    
    // Fallback to mock service for other errors
    const { generateTicket } = await import('./mockAI');
    const mockResult = await generateTicket(input);
    
    // Add a note that this is a fallback
    return {
      ...mockResult,
      content: `> **Note**: AI service temporarily unavailable, showing sample template.\n\n${mockResult.content}`
    };
  }
}