import { Env } from '../index';

const OPENROUTER_MODEL = 'anthropic/claude-3.5-haiku';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generateMockTitle(description: string): string {
  const lower = description.toLowerCase();
  
  // Smart keyword matching
  if (lower.includes('login') || lower.includes('auth') || lower.includes('password')) 
    return 'Implement passwordless login with magic links';
  if (lower.includes('dark') || lower.includes('theme') || lower.includes('mode'))
    return 'Add dark mode support for dashboard widgets';
  if (lower.includes('export') || lower.includes('pdf') || lower.includes('download'))
    return 'Export reports to PDF with charts';
  if (lower.includes('notification') || lower.includes('alert') || lower.includes('push'))
    return 'Real-time notifications via WebSocket';
  if (lower.includes('api') || lower.includes('rate') || lower.includes('limit'))
    return 'API rate limiting implementation';
  if (lower.includes('mobile') || lower.includes('responsive') || lower.includes('phone'))
    return 'Responsive mobile layout redesign';
  if (lower.includes('search') || lower.includes('filter') || lower.includes('find'))
    return 'Global search functionality';
  if (lower.includes('user') || lower.includes('profile') || lower.includes('account'))
    return 'User profile management page';
  if (lower.includes('payment') || lower.includes('stripe') || lower.includes('billing'))
    return 'Integrate payment processing with Stripe';
  if (lower.includes('email') || lower.includes('mail') || lower.includes('smtp'))
    return 'Email notification system setup';
  if (lower.includes('csv') || lower.includes('excel') || lower.includes('import'))
    return 'CSV data import and export feature';
  if (lower.includes('chart') || lower.includes('graph') || lower.includes('analytics'))
    return 'Dashboard analytics and charts';
  if (lower.includes('security') || lower.includes('2fa') || lower.includes('mfa'))
    return 'Two-factor authentication support';
  if (lower.includes('invite') || lower.includes('team') || lower.includes('member'))
    return 'Team invitation and member management';
  if (lower.includes('webhook') || lower.includes('callback') || lower.includes('event'))
    return 'Webhook event handling system';
  
  // Extract first few meaningful words
  const words = description.split(' ').filter(w => w.length > 3);
  const keyWords = words.slice(0, 3).join(' ');
  return `Implement ${keyWords || 'new feature'}`;
}

function fallbackTicketContent(description: string, prompt?: string): string {
  const summary = description.trim() || 'Refine this ticket'
  const extra = (prompt || '').trim()

  return `# Ticket Draft

## Summary
${summary}

${extra ? `## Direction\n${extra}\n\n` : ''}## Acceptance Criteria
- [ ] Requirements are clearly scoped
- [ ] Edge cases are explicitly documented
- [ ] Validation/testing plan is included

## Notes
- Generated in fallback mode (no AI key configured).`;
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export const aiHandler = {
  // POST /api/ai/generate-title
  async generateTitle(request: Request, env: Env): Promise<Response> {
    try {
      const { description } = await request.json() as { description: string };
      
      if (!description || description.length < 5) {
        return jsonResponse({ error: 'Description too short' }, 400);
      }

      // Generate mock title first (fallback)
      const mockTitle = generateMockTitle(description);

      // If no API key, return mock response
      if (!env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY === 'your_openrouter_key_here') {
        console.log('No OpenRouter API key, using mock title:', mockTitle);
        return jsonResponse({ title: mockTitle });
      }

      console.log('Calling OpenRouter with key:', env.OPENROUTER_API_KEY.slice(0, 10) + '...');

      // Call OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': request.headers.get('Origin') || 'https://sprintflow.dev',
          'X-Title': 'SprintFlow',
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are a product manager who writes clear, concise ticket titles. 
Convert the user's description into a professional ticket title (5-10 words).
Be specific and actionable. Return ONLY the title, nothing else.`
            },
            {
              role: 'user',
              content: `Create a ticket title for: "${description}"`
            }
          ],
          max_tokens: 50,
          temperature: 0.3,
        }),
      });

      console.log('OpenRouter response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter error:', response.status, errorText);
        // Return mock title as fallback
        return jsonResponse({ title: mockTitle });
      }

      const data = await response.json() as {
        choices?: [{ message?: { content?: string } }];
        error?: { message: string };
      };
      
      console.log('OpenRouter response:', JSON.stringify(data).slice(0, 200));
      
      if (data.error) {
        console.error('OpenRouter API error:', data.error);
        return jsonResponse({ title: mockTitle });
      }
      
      const title = data.choices?.[0]?.message?.content?.trim();
      
      if (!title) {
        console.log('No title in response, using mock');
        return jsonResponse({ title: mockTitle });
      }
      
      return jsonResponse({ title });
    } catch (error) {
      console.error('Error generating title:', error);
      // Always return a usable title
      const fallback = generateMockTitle('feature');
      return jsonResponse({ title: fallback });
    }
  },

  // POST /api/ai/regenerate-content
  async regenerateContent(request: Request, env: Env): Promise<Response> {
    try {
      const { description, prompt } = await request.json() as { description?: string; prompt?: string };

      const baseDescription = (description || '').trim();
      const userPrompt = (prompt || '').trim();
      if (!baseDescription && !userPrompt) {
        return jsonResponse({ error: 'description or prompt is required' }, 400);
      }

      const fallback = fallbackTicketContent(baseDescription || 'Regenerate this ticket content', userPrompt);

      if (!env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY === 'your_openrouter_key_here') {
        return jsonResponse({ content: fallback });
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': request.headers.get('Origin') || 'https://sprintflow.dev',
          'X-Title': 'SprintFlow Ticket Content Regeneration',
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a senior PM and technical writer. Write a clean, implementation-ready ticket in markdown with clear sections, checklists, and concise language.',
            },
            {
              role: 'user',
              content: `Base context:\n${baseDescription || '(none provided)'}\n\n${userPrompt ? `Additional direction:\n${userPrompt}\n\n` : ''}Return only the final markdown ticket content.`,
            },
          ],
          max_tokens: 1400,
          temperature: 0.35,
        }),
      });

      if (!response.ok) {
        console.error('OpenRouter regenerate-content failed:', response.status, await safeText(response));
        return jsonResponse({ content: fallback });
      }

      const data = await response.json() as {
        choices?: [{ message?: { content?: string } }];
      };
      const content = data.choices?.[0]?.message?.content?.trim();

      return jsonResponse({ content: content || fallback });
    } catch (error) {
      console.error('Error regenerating ticket content:', error);
      return jsonResponse({ content: fallbackTicketContent('Regenerate this ticket content') });
    }
  },
};
