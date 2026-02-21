import { AuthError, requireUserId } from '../auth';
import { decryptSecret, encryptSecret } from '../crypto';
import { Env } from '../index';
import { buildEnhancedPrompt } from '../ticketPrompt';

const GITLAB_BASE_URL = 'https://gitlab.com';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

type SyncMode = 'update' | 'create';
type GitLabIssueStateEvent = 'close' | 'reopen';
type TicketStatus = 'icebox' | 'todo' | 'progress' | 'review' | 'done';

const TICKET_STATUSES = new Set<TicketStatus>(['icebox', 'todo', 'progress', 'review', 'done']);
const PRIORITY_LABEL_COLORS = {
  'priority::high': '#DC2626',
  'priority::medium': '#EAB308',
  'priority::low': '#16A34A',
} as const;
const STATUS_LABEL_COLORS = {
  'status::icebox': '#94A3B8',
  'status::todo': '#93C5FD',
  'status::progress': '#60A5FA',
  'status::review': '#3B82F6',
  'status::done': '#1D4ED8',
} as const;

interface GitLabIntegrationRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token?: string | null;
  access_token_expires_at?: string | null;
  repo_id?: number | null;
  repo_name?: string | null;
  repo_url?: string | null;
  repo_path?: string | null;
  repo_web_url?: string | null;
  connected_at: string;
  updated_at?: string | null;
}

interface GitLabOAuthStateRow {
  state: string;
  user_id: string;
  expires_at: string;
}

interface GitLabTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
}

interface GitLabProjectMember {
  id: number;
  username: string;
  name: string;
  state?: string;
  avatar_url?: string;
  web_url?: string;
}

interface GitLabProjectHook {
  id: number;
  url: string;
  issues_events?: boolean;
}

interface GitLabIssue {
  id: number;
  iid: number;
  web_url: string;
}

interface GitLabProjectLabel {
  name: string;
  color?: string;
}

interface GitLabMilestone {
  id: number;
  title: string;
}

interface OpenRouterChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface GitLabWebhookProject {
  id?: number;
}

interface GitLabWebhookLabel {
  title?: string;
}

interface GitLabWebhookObjectAttributes {
  id?: number;
  iid?: number;
  state?: string;
  action?: string;
  project_id?: number;
}

interface GitLabIssueWebhookPayload {
  object_kind?: string;
  event_type?: string;
  project?: GitLabWebhookProject;
  labels?: GitLabWebhookLabel[] | string[];
  object_attributes?: GitLabWebhookObjectAttributes & {
    labels?: GitLabWebhookLabel[] | string[];
  };
}

class RouteError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, error: string): Response {
  return jsonResponse({ error, code }, status);
}

function getAppBaseUrl(request: Request, env: Env): string {
  const configured = env.APP_BASE_URL?.trim();
  if (configured) {
    try {
      const configuredUrl = new URL(configured);
      const requestUrl = new URL(request.url);
      const configuredHost = configuredUrl.hostname.toLowerCase();
      const requestHost = requestUrl.hostname.toLowerCase();
      const configuredIsLocal = configuredHost === 'localhost' || configuredHost === '127.0.0.1';
      const requestIsLocal = requestHost === 'localhost' || requestHost === '127.0.0.1';

      // Prevent production callbacks from being redirected to localhost due to stale config.
      if (!(configuredIsLocal && !requestIsLocal)) {
        return configured.replace(/\/+$/, '');
      }
    } catch {
      return configured.replace(/\/+$/, '');
    }
  }

  const url = new URL(request.url);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  return `${url.protocol}//${url.host}`;
}

function redirectToApp(status: 'connected' | 'error', request: Request, env: Env): Response {
  const baseUrl = getAppBaseUrl(request, env);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${baseUrl}/app?gitlab=${status}`,
    },
  });
}

function asRouteError(error: unknown): RouteError {
  if (error instanceof RouteError) {
    return error;
  }
  if (error instanceof AuthError) {
    return new RouteError(error.status, error.code, error.message);
  }
  return new RouteError(500, 'internal_error', 'Unexpected server error');
}

function requireGitLabConfig(env: Env): void {
  if (!env.GITLAB_CLIENT_ID || !env.GITLAB_CLIENT_SECRET) {
    throw new RouteError(500, 'gitlab_not_configured', 'GitLab OAuth is not configured');
  }
}

function requireEncryptionKey(env: Env): string {
  if (!env.GITLAB_TOKEN_ENCRYPTION_KEY) {
    throw new RouteError(500, 'gitlab_encryption_not_configured', 'GitLab token encryption key is missing');
  }
  return env.GITLAB_TOKEN_ENCRYPTION_KEY;
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function tokenIsExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiryMs = Date.parse(expiresAt);
  if (Number.isNaN(expiryMs)) {
    return false;
  }

  return expiryMs - TOKEN_EXPIRY_BUFFER_MS <= Date.now();
}

async function cleanupExpiredOAuthStates(env: Env): Promise<void> {
  await env.DB.prepare('DELETE FROM gitlab_oauth_states WHERE expires_at <= ?')
    .bind(new Date().toISOString())
    .run();
}

async function getIntegrationByUserId(env: Env, userId: string): Promise<GitLabIntegrationRow | null> {
  return env.DB.prepare('SELECT * FROM gitlab_integrations WHERE user_id = ?')
    .bind(userId)
    .first<GitLabIntegrationRow>();
}

async function getOAuthState(env: Env, state: string): Promise<GitLabOAuthStateRow | null> {
  return env.DB.prepare('SELECT * FROM gitlab_oauth_states WHERE state = ?')
    .bind(state)
    .first<GitLabOAuthStateRow>();
}

async function deleteOAuthState(env: Env, state: string): Promise<void> {
  await env.DB.prepare('DELETE FROM gitlab_oauth_states WHERE state = ?').bind(state).run();
}

async function decryptIntegrationTokens(integration: GitLabIntegrationRow, env: Env): Promise<{ accessToken: string; refreshToken: string | null }> {
  const encryptionKey = requireEncryptionKey(env);

  try {
    const accessToken = await decryptSecret(integration.access_token, encryptionKey);
    let refreshToken: string | null = null;

    if (integration.refresh_token) {
      refreshToken = await decryptSecret(integration.refresh_token, encryptionKey);
    }

    return { accessToken, refreshToken };
  } catch {
    throw new RouteError(
      409,
      'gitlab_reconnect_required',
      'GitLab credentials need to be reconnected. Please reconnect your GitLab account.'
    );
  }
}

async function refreshAccessToken(env: Env, integration: GitLabIntegrationRow): Promise<GitLabIntegrationRow> {
  requireGitLabConfig(env);
  const encryptionKey = requireEncryptionKey(env);
  const { refreshToken } = await decryptIntegrationTokens(integration, env);

  if (!refreshToken) {
    throw new RouteError(
      409,
      'gitlab_reconnect_required',
      'GitLab session expired. Please reconnect your GitLab account.'
    );
  }

  const params = new URLSearchParams({
    client_id: env.GITLAB_CLIENT_ID,
    client_secret: env.GITLAB_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const tokenResponse = await fetch(`${GITLAB_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!tokenResponse.ok) {
    throw new RouteError(
      409,
      'gitlab_reconnect_required',
      'GitLab authorization expired. Please reconnect your GitLab account.'
    );
  }

  const tokenData = await safeJson<GitLabTokenResponse>(tokenResponse);
  if (!tokenData?.access_token) {
    throw new RouteError(
      409,
      'gitlab_reconnect_required',
      'GitLab authorization expired. Please reconnect your GitLab account.'
    );
  }

  const encryptedAccessToken = await encryptSecret(tokenData.access_token, encryptionKey);
  const encryptedRefreshToken = tokenData.refresh_token
    ? await encryptSecret(tokenData.refresh_token, encryptionKey)
    : integration.refresh_token || null;
  const accessTokenExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
    : null;
  const now = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE gitlab_integrations
    SET access_token = ?, refresh_token = ?, access_token_expires_at = ?, updated_at = ?
    WHERE user_id = ?
  `).bind(
    encryptedAccessToken,
    encryptedRefreshToken,
    accessTokenExpiresAt,
    now,
    integration.user_id
  ).run();

  const refreshed = await getIntegrationByUserId(env, integration.user_id);
  if (!refreshed) {
    throw new RouteError(500, 'integration_not_found', 'GitLab integration not found after refresh');
  }

  return refreshed;
}

async function ensureFreshIntegration(env: Env, integration: GitLabIntegrationRow): Promise<GitLabIntegrationRow> {
  if (tokenIsExpired(integration.access_token_expires_at)) {
    return refreshAccessToken(env, integration);
  }
  return integration;
}

async function gitlabFetch(
  env: Env,
  integration: GitLabIntegrationRow,
  path: string,
  init: RequestInit = {},
  allowRefreshRetry = true
): Promise<{ response: Response; integration: GitLabIntegrationRow }> {
  let activeIntegration = await ensureFreshIntegration(env, integration);
  let { accessToken } = await decryptIntegrationTokens(activeIntegration, env);

  const buildHeaders = () => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    return headers;
  };

  let response = await fetch(`${GITLAB_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(),
  });

  if (response.status === 401 && allowRefreshRetry) {
    activeIntegration = await refreshAccessToken(env, activeIntegration);
    ({ accessToken } = await decryptIntegrationTokens(activeIntegration, env));
    response = await fetch(`${GITLAB_BASE_URL}${path}`, {
      ...init,
      headers: buildHeaders(),
    });
  }

  if (response.status === 401) {
    throw new RouteError(
      409,
      'gitlab_reconnect_required',
      'GitLab authorization expired. Please reconnect your GitLab account.'
    );
  }

  return { response, integration: activeIntegration };
}

function mapRepo(integration: GitLabIntegrationRow): { id: number; name: string; fullName: string; url: string } | null {
  if (!integration.repo_id) {
    return null;
  }

  return {
    id: integration.repo_id,
    name: integration.repo_name || '',
    fullName: integration.repo_path || integration.repo_url || '',
    url: integration.repo_web_url || integration.repo_url || '',
  };
}

function getWebhookEndpoint(request: Request): string | null {
  const url = new URL(request.url);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return null;
  }
  return `${url.protocol}//${url.host}/api/gitlab/webhook`;
}

function hasStructuredTicketFormat(description?: string | null): boolean {
  if (!description) return false;

  const markers = [
    /^#{1,3}\s+/m,
    /Acceptance Criteria/i,
    /Definition of Done/i,
    /- \[[ xX]\]/,
    /\*\*Priority:\*\*/i,
  ];

  return markers.some(marker => marker.test(description));
}

function fallbackTicketBody(title: string, description?: string | null): string {
  const summary = description?.trim() || `Implement ${title}`;

  return `## Summary
${summary}

## Acceptance Criteria
- [ ] The implementation matches the requested behavior
- [ ] Error handling and edge cases are covered
- [ ] Changes are validated in staging
- [ ] Documentation is updated where relevant

## Technical Considerations
- Clarify integration points and dependencies
- Add tests for core behavior and regressions
- Confirm performance and security impact

## Definition of Done
- [ ] Code complete and reviewed
- [ ] Tests pass
- [ ] Product acceptance criteria met

**Priority:** Medium
**Labels:** source::myba`;
}

async function buildProfessionalIssueDescription(
  request: Request,
  env: Env,
  title: string,
  description?: string | null
): Promise<string> {
  if (hasStructuredTicketFormat(description)) {
    return description!.trim();
  }

  const fallback = fallbackTicketBody(title, description);
  const rawInput = description?.trim();

  if (!rawInput || rawInput.length < 8) {
    return fallback;
  }

  if (!env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY === 'your_openrouter_key_here') {
    return fallback;
  }

  try {
    const prompt = buildEnhancedPrompt(rawInput);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': request.headers.get('Origin') || 'https://sprintflow.dev',
        'X-Title': 'SprintFlow GitLab Sync',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        messages: [
          {
            role: 'system',
            content: 'You are a senior product manager and technical writer who creates exceptional, detailed tickets for software development teams. You understand different ticket types (bugs, features, epics, tasks, improvements) and tailor your responses accordingly. Always use professional language with clear structure and actionable details.',
          },
          {
            role: 'user',
            content: prompt,
          }
        ],
        max_tokens: 1200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter ticket-body generation failed:', response.status, await safeText(response));
      return fallback;
    }

    const data = await safeJson<OpenRouterChatResponse>(response);
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content || content.length < 30) {
      return fallback;
    }

    return content;
  } catch (error) {
    console.error('Ticket-body generation error:', error);
    return fallback;
  }
}

function normalizeLabelValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function parseStatusFromLabel(value: string): TicketStatus | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized.startsWith('status::')) {
    return null;
  }

  const statusValue = normalized.slice('status::'.length) as TicketStatus;
  if (!TICKET_STATUSES.has(statusValue)) {
    return null;
  }

  return statusValue;
}

function extractStatusFromLabels(labels: GitLabWebhookLabel[] | string[] | undefined): TicketStatus | null {
  if (!labels || !Array.isArray(labels)) {
    return null;
  }

  for (const label of labels) {
    const title = typeof label === 'string' ? label : label?.title;
    if (!title) continue;
    const status = parseStatusFromLabel(title);
    if (status) return status;
  }

  return null;
}

function deriveTicketStatusFromWebhook(payload: GitLabIssueWebhookPayload): TicketStatus | null {
  const attributes = payload.object_attributes;
  const state = attributes?.state?.toLowerCase();

  if (state === 'closed') {
    return 'done';
  }

  const statusFromLabels = extractStatusFromLabels(attributes?.labels)
    || extractStatusFromLabels(payload.labels);
  if (statusFromLabels) {
    return statusFromLabels;
  }

  if (state === 'opened' || state === 'open' || state === 'reopened') {
    return 'todo';
  }

  return null;
}

async function repoHasIntegration(env: Env, repoId: number): Promise<boolean> {
  const row = await env.DB.prepare('SELECT 1 as value FROM gitlab_integrations WHERE repo_id = ? LIMIT 1')
    .bind(repoId)
    .first<{ value: number }>();
  return Boolean(row?.value);
}

async function ensureProjectWebhook(
  request: Request,
  env: Env,
  integration: GitLabIntegrationRow,
  projectId: number
): Promise<{ configured: boolean; warning?: string }> {
  const webhookSecret = env.GITLAB_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return { configured: false, warning: 'missing_webhook_secret' };
  }

  const webhookEndpoint = getWebhookEndpoint(request);
  if (!webhookEndpoint) {
    return { configured: false, warning: 'local_dev' };
  }

  try {
    const { response: hooksResponse } = await gitlabFetch(
      env,
      integration,
      `/api/v4/projects/${projectId}/hooks?per_page=100`
    );

    if (!hooksResponse.ok) {
      const message = await safeText(hooksResponse);
      console.error('GitLab hooks list failed:', hooksResponse.status, message);
      return { configured: false, warning: 'hook_list_failed' };
    }

    const hooks = (await safeJson<GitLabProjectHook[]>(hooksResponse)) || [];
    const existing = hooks.find((hook) => hook.url === webhookEndpoint);

    if (existing) {
      if (existing.issues_events) {
        return { configured: true };
      }

      const { response: updateResponse } = await gitlabFetch(
        env,
        integration,
        `/api/v4/projects/${projectId}/hooks/${existing.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookEndpoint,
            issues_events: true,
            token: webhookSecret,
            enable_ssl_verification: true,
          }),
        }
      );

      if (updateResponse.ok) {
        return { configured: true };
      }

      const message = await safeText(updateResponse);
      console.error('GitLab hook update failed:', updateResponse.status, message);
      return { configured: false, warning: updateResponse.status === 403 ? 'hook_permission_denied' : 'hook_update_failed' };
    }

    const { response: createResponse } = await gitlabFetch(
      env,
      integration,
      `/api/v4/projects/${projectId}/hooks`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookEndpoint,
          issues_events: true,
          token: webhookSecret,
          enable_ssl_verification: true,
        }),
      }
    );

    if (createResponse.ok) {
      return { configured: true };
    }

    const message = await safeText(createResponse);
    console.error('GitLab hook create failed:', createResponse.status, message);
    return { configured: false, warning: createResponse.status === 403 ? 'hook_permission_denied' : 'hook_create_failed' };
  } catch (error) {
    if (error instanceof RouteError) {
      throw error;
    }
    console.error('GitLab hook ensure error:', error);
    return { configured: false, warning: 'hook_setup_error' };
  }
}

async function fetchProjectMembers(
  env: Env,
  integration: GitLabIntegrationRow,
  query?: string
): Promise<GitLabProjectMember[]> {
  if (!integration.repo_id) {
    throw new RouteError(409, 'gitlab_repo_not_selected', 'Select a GitLab repository before listing members');
  }

  const params = new URLSearchParams({
    per_page: '100',
  });

  const search = query?.trim();
  if (search) {
    params.set('query', search);
  }

  const { response } = await gitlabFetch(
    env,
    integration,
    `/api/v4/projects/${integration.repo_id}/members/all?${params.toString()}`
  );

  if (!response.ok) {
    throw new RouteError(502, 'gitlab_api_error', 'Failed to list GitLab project members');
  }

  const members = await safeJson<GitLabProjectMember[]>(response);
  return (members || []).filter((member) => member.state !== 'blocked');
}

function normalizeAssigneeLookup(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

async function resolveAssigneeId(
  env: Env,
  integration: GitLabIntegrationRow,
  assignee: string
): Promise<number | null> {
  const normalizedAssignee = normalizeAssigneeLookup(assignee);
  if (!normalizedAssignee) {
    return null;
  }

  const members = await fetchProjectMembers(env, integration, normalizedAssignee);
  const exact = members.find((member) => {
    const username = normalizeAssigneeLookup(member.username);
    const name = normalizeAssigneeLookup(member.name);
    return username === normalizedAssignee || name === normalizedAssignee;
  });

  return exact?.id ?? null;
}

async function ensurePriorityLabelColors(env: Env, integration: GitLabIntegrationRow): Promise<void> {
  const repoId = integration.repo_id;
  if (!repoId) {
    return;
  }

  const { response } = await gitlabFetch(
    env,
    integration,
    `/api/v4/projects/${repoId}/labels?per_page=100`
  );

  if (!response.ok) {
    console.error('Failed to list GitLab labels for priority color sync:', response.status, await safeText(response));
    return;
  }

  const existingLabels = await safeJson<GitLabProjectLabel[]>(response) || [];
  const existingByName = new Map(
    existingLabels.map((label) => [label.name, (label.color || '').toLowerCase()])
  );

  const managedLabelColors = {
    ...PRIORITY_LABEL_COLORS,
    ...STATUS_LABEL_COLORS,
  };

  for (const [labelName, labelColor] of Object.entries(managedLabelColors)) {
    const normalizedColor = labelColor.toLowerCase();
    const existingColor = existingByName.get(labelName);

    if (!existingColor) {
      const { response: createResponse } = await gitlabFetch(env, integration, `/api/v4/projects/${repoId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: labelName, color: labelColor }),
      });

      if (!createResponse.ok) {
        console.error('Failed to create GitLab priority label:', labelName, createResponse.status, await safeText(createResponse));
      }
      continue;
    }

    if (existingColor !== normalizedColor) {
      const { response: updateResponse } = await gitlabFetch(env, integration, `/api/v4/projects/${repoId}/labels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: labelName, color: labelColor }),
      });

      if (!updateResponse.ok) {
        console.error('Failed to update GitLab priority label color:', labelName, updateResponse.status, await safeText(updateResponse));
      }
    }
  }
}

async function findMilestoneIdByVersion(
  env: Env,
  integration: GitLabIntegrationRow,
  version: string
): Promise<number | null> {
  const repoId = integration.repo_id;
  if (!repoId) {
    return null;
  }

  const query = new URLSearchParams({
    search: version,
    per_page: '100',
  });

  const { response } = await gitlabFetch(
    env,
    integration,
    `/api/v4/projects/${repoId}/milestones?${query.toString()}`
  );

  if (!response.ok) {
    return null;
  }

  const milestones = await safeJson<GitLabMilestone[]>(response);
  const exact = (milestones || []).find(
    (milestone) => milestone.title.trim().toLowerCase() === version.trim().toLowerCase()
  );

  return exact?.id ?? null;
}

async function buildIssueMetadata(
  env: Env,
  integration: GitLabIntegrationRow,
  ticket: {
    status?: string | null;
    priority?: string | null;
    version?: string | null;
  }
): Promise<{ labels: string; milestoneId?: number }> {
  const labels = new Set<string>(['source::myba']);

  if (ticket.priority) {
    labels.add(`priority::${normalizeLabelValue(ticket.priority)}`);
  }

  if (ticket.status) {
    labels.add(`status::${normalizeLabelValue(ticket.status)}`);
  }

  const version = ticket.version?.trim();
  if (!version) {
    return { labels: Array.from(labels).join(',') };
  }

  const milestoneId = await findMilestoneIdByVersion(env, integration, version);
  if (milestoneId) {
    return {
      labels: Array.from(labels).join(','),
      milestoneId,
    };
  }

  labels.add(`release::${normalizeLabelValue(version)}`);
  return { labels: Array.from(labels).join(',') };
}

function mapStatusToStateEvent(status?: string | null): GitLabIssueStateEvent {
  return status === 'done' ? 'close' : 'reopen';
}

async function requireConnectedIntegration(env: Env, userId: string): Promise<GitLabIntegrationRow> {
  const integration = await getIntegrationByUserId(env, userId);
  if (!integration) {
    throw new RouteError(409, 'gitlab_not_connected', 'GitLab is not connected for this user');
  }
  return integration;
}

export const gitlabHandler = {
  // GET /api/gitlab/auth-url
  async getAuthUrl(request: Request, env: Env): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      requireGitLabConfig(env);
      requireEncryptionKey(env);

      await cleanupExpiredOAuthStates(env);

      const state = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();

      await env.DB.prepare(`
        INSERT INTO gitlab_oauth_states (state, user_id, expires_at)
        VALUES (?, ?, ?)
      `).bind(state, userId, expiresAt).run();

      const redirectUri = `${new URL(request.url).origin}/api/gitlab/callback`;
      const authUrl = `${GITLAB_BASE_URL}/oauth/authorize?${new URLSearchParams({
        client_id: env.GITLAB_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
        scope: 'api read_user',
      })}`;

      return jsonResponse({ url: authUrl });
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // GET /api/gitlab/callback
  async handleCallback(request: Request, env: Env): Promise<Response> {
    try {
      requireGitLabConfig(env);
      const encryptionKey = requireEncryptionKey(env);

      const url = new URL(request.url);
      const oauthError = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (oauthError || !code || !state) {
        return redirectToApp('error', request, env);
      }

      await cleanupExpiredOAuthStates(env);

      const oauthState = await getOAuthState(env, state);
      if (!oauthState) {
        return redirectToApp('error', request, env);
      }

      await deleteOAuthState(env, state);

      const oauthExpiresAt = Date.parse(oauthState.expires_at);
      if (Number.isNaN(oauthExpiresAt) || oauthExpiresAt <= Date.now()) {
        return redirectToApp('error', request, env);
      }

      const redirectUri = `${url.origin}/api/gitlab/callback`;
      const tokenParams = new URLSearchParams({
        client_id: env.GITLAB_CLIENT_ID,
        client_secret: env.GITLAB_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });

      const tokenResponse = await fetch(`${GITLAB_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      if (!tokenResponse.ok) {
        console.error('GitLab token exchange failed:', tokenResponse.status, await safeText(tokenResponse));
        return redirectToApp('error', request, env);
      }

      const tokenData = await safeJson<GitLabTokenResponse>(tokenResponse);
      if (!tokenData?.access_token) {
        return redirectToApp('error', request, env);
      }

      const encryptedAccessToken = await encryptSecret(tokenData.access_token, encryptionKey);
      const encryptedRefreshToken = tokenData.refresh_token
        ? await encryptSecret(tokenData.refresh_token, encryptionKey)
        : null;
      const accessTokenExpiresAt = tokenData.expires_in
        ? new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
        : null;
      const now = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO gitlab_integrations (
          id,
          user_id,
          access_token,
          refresh_token,
          access_token_expires_at,
          connected_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          access_token_expires_at = excluded.access_token_expires_at,
          connected_at = excluded.connected_at,
          updated_at = excluded.updated_at
      `).bind(
        crypto.randomUUID(),
        oauthState.user_id,
        encryptedAccessToken,
        encryptedRefreshToken,
        accessTokenExpiresAt,
        now,
        now
      ).run();

      return redirectToApp('connected', request, env);
    } catch (error) {
      console.error('GitLab callback error:', error);
      return redirectToApp('error', request, env);
    }
  },

  // GET /api/gitlab/integration
  async getIntegration(request: Request, env: Env): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const integration = await getIntegrationByUserId(env, userId);

      if (!integration) {
        return jsonResponse({ connected: false, repo: null, connectedAt: null });
      }

      return jsonResponse({
        connected: true,
        repo: mapRepo(integration),
        connectedAt: integration.connected_at,
      });
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // GET /api/gitlab/repos
  async listRepos(request: Request, env: Env): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const integration = await requireConnectedIntegration(env, userId);

      const { response } = await gitlabFetch(
        env,
        integration,
        '/api/v4/projects?membership=true&simple=true&per_page=100&order_by=path'
      );

      if (!response.ok) {
        throw new RouteError(502, 'gitlab_api_error', 'Failed to list GitLab repositories');
      }

      const projects = await safeJson<GitLabProject[]>(response);
      return jsonResponse((projects || []).map((project) => ({
        id: project.id,
        name: project.name,
        fullName: project.path_with_namespace,
        url: project.web_url,
      })));
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // GET /api/gitlab/members
  async listMembers(request: Request, env: Env): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const integration = await requireConnectedIntegration(env, userId);
      const members = await fetchProjectMembers(env, integration);

      return jsonResponse(members.map((member) => ({
        id: member.id,
        username: member.username,
        name: member.name,
        avatarUrl: member.avatar_url || null,
        webUrl: member.web_url || null,
      })));
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // PUT /api/gitlab/repo
  async setRepo(request: Request, env: Env): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const integration = await requireConnectedIntegration(env, userId);

      let body: { projectId?: number } = {};
      try {
        body = await request.json() as { projectId?: number };
      } catch {
        throw new RouteError(400, 'invalid_payload', 'Invalid JSON payload');
      }

      if (!body.projectId || !Number.isFinite(body.projectId)) {
        throw new RouteError(400, 'invalid_project_id', 'projectId must be a valid number');
      }

      const projectId = Math.trunc(body.projectId);
      const { response } = await gitlabFetch(env, integration, `/api/v4/projects/${projectId}`);

      if (response.status === 404) {
        throw new RouteError(400, 'project_not_found', 'GitLab project not found or not accessible');
      }

      if (!response.ok) {
        throw new RouteError(502, 'gitlab_api_error', 'Failed to validate selected GitLab project');
      }

      const project = await safeJson<GitLabProject>(response);
      if (!project) {
        throw new RouteError(502, 'gitlab_api_error', 'Failed to read GitLab project details');
      }

      const now = new Date().toISOString();
      await env.DB.prepare(`
        UPDATE gitlab_integrations
        SET repo_id = ?, repo_name = ?, repo_url = ?, repo_path = ?, repo_web_url = ?, updated_at = ?
        WHERE user_id = ?
      `).bind(
        project.id,
        project.name,
        project.web_url,
        project.path_with_namespace,
        project.web_url,
        now,
        userId
      ).run();

      let webhookConfigured: boolean | undefined;
      let webhookWarning: string | undefined;
      try {
        const webhookResult = await ensureProjectWebhook(request, env, integration, project.id);
        webhookConfigured = webhookResult.configured;
        webhookWarning = webhookResult.warning;
      } catch (error) {
        if (error instanceof RouteError) {
          throw error;
        }
        console.error('Webhook auto-setup failed:', error);
        webhookConfigured = false;
        webhookWarning = 'hook_setup_error';
      }

      return jsonResponse({
        connected: true,
        repo: {
          id: project.id,
          name: project.name,
          fullName: project.path_with_namespace,
          url: project.web_url,
        },
        webhookConfigured,
        webhookWarning,
      });
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // POST /api/gitlab/webhook
  async handleWebhook(request: Request, env: Env): Promise<Response> {
    try {
      const configuredSecret = env.GITLAB_WEBHOOK_SECRET?.trim();
      const incomingSecret = request.headers.get('x-gitlab-token')?.trim();

      if (configuredSecret && incomingSecret !== configuredSecret) {
        return errorResponse(401, 'invalid_webhook_token', 'Invalid GitLab webhook token');
      }

      let payload: GitLabIssueWebhookPayload;
      try {
        payload = await request.json() as GitLabIssueWebhookPayload;
      } catch {
        return errorResponse(400, 'invalid_payload', 'Invalid webhook payload');
      }

      if (payload.object_kind !== 'issue') {
        return jsonResponse({ ok: true, ignored: 'unsupported_event' });
      }

      const attributes = payload.object_attributes;
      const projectId = payload.project?.id ?? attributes?.project_id;
      if (!attributes?.id || !projectId) {
        return jsonResponse({ ok: true, ignored: 'missing_issue_context' });
      }

      const connectedProject = await repoHasIntegration(env, projectId);
      if (!connectedProject) {
        return jsonResponse({ ok: true, ignored: 'unknown_project' });
      }

      const derivedStatus = deriveTicketStatusFromWebhook(payload);
      if (!derivedStatus) {
        return jsonResponse({ ok: true, ignored: 'no_status_mapping' });
      }

      const now = new Date().toISOString();
      const issueId = String(attributes.id);
      const projectKey = `gitlab:${projectId}`;
      const byIdResult = await env.DB.prepare(`
        UPDATE tickets
        SET status = ?, updated_at = ?
        WHERE gitlab_issue_id = ? AND project_key = ?
      `).bind(derivedStatus, now, issueId, projectKey).run();

      let changes = Number(byIdResult.meta?.changes || 0);

      if (!changes && attributes.iid) {
        const matches = await env.DB.prepare(`
          SELECT id
          FROM tickets
          WHERE gitlab_issue_number = ? AND project_key = ?
          LIMIT 2
        `).bind(attributes.iid, projectKey).all<{ id: string }>();

        if ((matches.results || []).length === 1) {
          const ticketId = matches.results[0].id;
          const byNumberResult = await env.DB.prepare(`
            UPDATE tickets
            SET status = ?, updated_at = ?
            WHERE id = ?
          `).bind(derivedStatus, now, ticketId).run();
          changes = Number(byNumberResult.meta?.changes || 0);
        }
      }

      return jsonResponse({
        ok: true,
        status: derivedStatus,
        updated: changes > 0,
      });
    } catch (error) {
      console.error('GitLab webhook error:', error);
      return errorResponse(500, 'webhook_error', 'Failed to process GitLab webhook');
    }
  },

  // POST /api/gitlab/sync/:ticketId
  async syncTicket(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const integration = await requireConnectedIntegration(env, userId);

      if (!integration.repo_id) {
        throw new RouteError(409, 'gitlab_repo_not_selected', 'Select a GitLab repository before syncing tickets');
      }

      let body: { mode?: SyncMode } = {};
      try {
        body = await request.json() as { mode?: SyncMode };
      } catch {
        throw new RouteError(400, 'invalid_payload', 'Invalid JSON payload');
      }

      const mode: SyncMode = body.mode === 'update' ? 'update' : body.mode === 'create' ? 'create' : (() => {
        throw new RouteError(400, 'invalid_sync_mode', 'mode must be either "update" or "create"');
      })();

      const ticketId = params.ticketId;
      const projectKey = `gitlab:${integration.repo_id}`;
      const ticket = await env.DB.prepare(`
        SELECT id, title, description, generated_content, assignee, status, priority, version, gitlab_issue_id, gitlab_issue_number
        FROM tickets
        WHERE id = ? AND project_key = ?
      `).bind(ticketId, projectKey).first<{
        id: string;
        title: string;
        description?: string;
        generated_content?: string | null;
        assignee?: string | null;
        status?: string | null;
        priority?: string | null;
        version?: string | null;
        gitlab_issue_id?: string | null;
        gitlab_issue_number?: number | null;
      }>();

      if (!ticket) {
        throw new RouteError(404, 'ticket_not_found', 'Ticket not found');
      }

      try {
        await ensurePriorityLabelColors(env, integration);
      } catch (error) {
        console.error('Priority label color sync failed:', error);
      }

      const issueMetadata = await buildIssueMetadata(env, integration, ticket);
      const shouldUpdateExisting = Boolean(ticket.gitlab_issue_number) && mode === 'update';

      const issuePayload: {
        title: string;
        description?: string;
        labels: string;
        milestone_id?: number;
        assignee_ids?: number[];
        state_event?: GitLabIssueStateEvent;
      } = {
        title: ticket.title,
        labels: issueMetadata.labels,
      };

      let generatedContentForTicket: string | null = null;

      if (!shouldUpdateExisting) {
        const existingGenerated = ticket.generated_content?.trim();
        generatedContentForTicket = existingGenerated || await buildProfessionalIssueDescription(
          request,
          env,
          ticket.title,
          ticket.description
        );
        issuePayload.description = generatedContentForTicket;
      }
      if (issueMetadata.milestoneId) {
        issuePayload.milestone_id = issueMetadata.milestoneId;
      }
      if (ticket.assignee) {
        const assigneeId = await resolveAssigneeId(env, integration, ticket.assignee);
        if (assigneeId) {
          issuePayload.assignee_ids = [assigneeId];
        }
      }
      if (shouldUpdateExisting) {
        issuePayload.state_event = mapStatusToStateEvent(ticket.status);
        const persistedGeneratedContent = ticket.generated_content?.trim();
        if (persistedGeneratedContent) {
          issuePayload.description = persistedGeneratedContent;
        }
      }

      const path = shouldUpdateExisting
        ? `/api/v4/projects/${integration.repo_id}/issues/${ticket.gitlab_issue_number}`
        : `/api/v4/projects/${integration.repo_id}/issues`;
      const method = shouldUpdateExisting ? 'PUT' : 'POST';

      const { response } = await gitlabFetch(env, integration, path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issuePayload),
      });

      if (shouldUpdateExisting && response.status === 404) {
        throw new RouteError(
          409,
          'gitlab_issue_not_found',
          'Linked GitLab issue was not found. Use create mode to create a new issue.'
        );
      }

      if (!response.ok) {
        const apiMessage = await safeText(response);
        console.error('GitLab sync failed:', response.status, apiMessage);
        throw new RouteError(502, 'gitlab_api_error', 'Failed to sync ticket with GitLab');
      }

      const issue = await safeJson<GitLabIssue>(response);
      if (!issue) {
        throw new RouteError(502, 'gitlab_api_error', 'Failed to parse GitLab issue response');
      }

      if (!shouldUpdateExisting && ticket.status === 'done') {
        const closePayload = JSON.stringify({ state_event: 'close' });
        const { response: closeResponse } = await gitlabFetch(
          env,
          integration,
          `/api/v4/projects/${integration.repo_id}/issues/${issue.iid}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: closePayload,
          }
        );

        if (!closeResponse.ok) {
          const closeMessage = await safeText(closeResponse);
          console.error('GitLab close-on-create failed:', closeResponse.status, closeMessage);
        }
      }

      const now = new Date().toISOString();
      await env.DB.prepare(`
        UPDATE tickets
        SET gitlab_issue_id = ?,
            gitlab_issue_number = ?,
            generated_content = COALESCE(?, generated_content),
            updated_at = ?
        WHERE id = ? AND project_key = ?
      `).bind(
        String(issue.id),
        issue.iid,
        generatedContentForTicket,
        now,
        ticketId,
        projectKey
      ).run();

      return jsonResponse({
        ticketId,
        gitlabIssueId: String(issue.id),
        gitlabIssueNumber: issue.iid,
        gitlabIssueUrl: issue.web_url,
        generatedContent: generatedContentForTicket ?? ticket.generated_content ?? null,
      });
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },
};
