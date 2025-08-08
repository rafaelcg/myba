import { GeneratedTicket } from './mockAI';
import { generateTicketWithBackend } from './backendService';

// This module previously called OpenRouter directly from the browser, which is insecure.
// All AI calls must go through the backend. We keep a minimal API for compatibility.

export interface OpenRouterConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class OpenRouterService {
  // Delegate to backend AI service
  async generateTicket(input: string): Promise<GeneratedTicket> {
    return generateTicketWithBackend(input);
  }
}

// Singleton instance for compatibility
let openRouterService: OpenRouterService | null = null;
export function getOpenRouterService(): OpenRouterService {
  if (!openRouterService) {
    openRouterService = new OpenRouterService();
  }
  return openRouterService;
}

// Helper for compatibility
export async function generateTicketWithOpenRouter(input: string): Promise<GeneratedTicket> {
  return generateTicketWithBackend(input);
}