const WORKER_ORIGIN = 'https://sprintflow.rafaelcg-a0a.workers.dev';

/**
 * Cloudflare Pages cannot proxy external origins via `_redirects`.
 * This Function forwards /api/* to the SprintFlow Worker so same-origin
 * `/api` calls from the SPA receive JSON instead of index.html.
 */
export async function onRequest(context: {
  request: Request;
  params: { path?: string | string[] };
}): Promise<Response> {
  const incoming = new URL(context.request.url);
  const target = new URL(incoming.pathname + incoming.search, WORKER_ORIGIN);

  const headers = new Headers(context.request.headers);
  headers.delete('host');

  const init: RequestInit = {
    method: context.request.method,
    headers,
    redirect: 'manual',
  };

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = context.request.body;
    // Required when forwarding a streamed body in the runtime.
    (init as RequestInit & { duplex?: string }).duplex = 'half';
  }

  return fetch(target.toString(), init);
}
