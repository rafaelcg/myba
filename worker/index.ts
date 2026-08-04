import { Router } from './router';
import { ticketsHandler } from './routes/tickets';
import { aiHandler } from './routes/ai';
import { gitlabHandler } from './routes/gitlab';
import { initializeDatabase } from './db';
import { getAuth } from './betterAuth';

// Minimal shape of the Cloudflare send_email binding (worker/ isn't covered
// by tsconfig, so generated worker-configuration types aren't available).
export interface SendEmailBinding {
  send(message: {
    to: string | string[];
    from: { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
  }): Promise<unknown>;
}

export interface Env {
  DB: D1Database;
  EMAIL: SendEmailBinding;
  OPENROUTER_API_KEY: string;
  GITLAB_CLIENT_ID: string;
  GITLAB_CLIENT_SECRET: string;
  GITLAB_TOKEN_ENCRYPTION_KEY: string;
  GITLAB_WEBHOOK_SECRET?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APP_BASE_URL?: string;
  ENVIRONMENT: string;
}

// Track if DB is initialized
let dbInitialized = false;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const router = new Router();
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gitlab-Token, X-Project-Key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Initialize database (blocking on first request)
    if (!dbInitialized) {
      try {
        await initializeDatabase(env);
        dbInitialized = true;
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    }

    // Better Auth owns everything under /api/auth (sessions, OAuth, sign-in).
    // Reached same-origin via the Pages proxy, so no CORS headers here —
    // wildcard origins are incompatible with credentialed cookie requests.
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/auth/')) {
      return getAuth(env).handler(request);
    }

    // Routes
    router.get('/api/health', () => new Response(JSON.stringify({ status: 'ok', env: env.ENVIRONMENT }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }));

    // Ticket routes
    router.get('/api/tickets', (req) => ticketsHandler.list(req, env));
    router.post('/api/tickets', (req) => ticketsHandler.create(req, env));
    router.post('/api/tickets/import-local', (req) => ticketsHandler.importLocal(req, env));
    router.get('/api/tickets/fields', (req) => ticketsHandler.listFields(req, env));
    router.post('/api/tickets/fields', (req) => ticketsHandler.createField(req, env));
    router.put('/api/tickets/fields/reorder', (req) => ticketsHandler.reorderFields(req, env));
    router.put('/api/tickets/fields/:id', (req, params) => ticketsHandler.updateField(req, env, params));
    router.delete('/api/tickets/fields/:id', (req, params) => ticketsHandler.deleteField(req, env, params));
    router.get('/api/tickets/:id', (req, params) => ticketsHandler.get(req, env, params));
    router.put('/api/tickets/:id', (req, params) => ticketsHandler.update(req, env, params));
    router.delete('/api/tickets/:id', (req, params) => ticketsHandler.remove(req, env, params));

    // AI routes
    router.post('/api/ai/generate-title', (req) => aiHandler.generateTitle(req, env));
    router.post('/api/ai/regenerate-content', (req) => aiHandler.regenerateContent(req, env));

    // GitLab routes
    router.get('/api/gitlab/auth-url', (req) => gitlabHandler.getAuthUrl(req, env));
    router.get('/api/gitlab/callback', (req) => gitlabHandler.handleCallback(req, env));
    router.get('/api/gitlab/integration', (req) => gitlabHandler.getIntegration(req, env));
    router.get('/api/gitlab/repos', (req) => gitlabHandler.listRepos(req, env));
    router.get('/api/gitlab/members', (req) => gitlabHandler.listMembers(req, env));
    router.put('/api/gitlab/repo', (req) => gitlabHandler.setRepo(req, env));
    router.post('/api/gitlab/webhook', (req) => gitlabHandler.handleWebhook(req, env));
    router.post('/api/gitlab/sync/:ticketId', (req, params) => gitlabHandler.syncTicket(req, env, params));

    const response = await router.handle(request);
    
    // Add CORS headers to all responses
    if (response) {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
    
    return response || new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
