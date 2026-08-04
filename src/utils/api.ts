// API client for the Cloudflare Worker backend.
// Same-origin `/api` everywhere: production proxies to the Worker via the
// Pages Function (functions/api/[[path]].ts), dev proxies via vite.config.ts.
// Same-origin is required so Better Auth session cookies ride along.
const ENV_API_BASE = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
const API_BASE = ENV_API_BASE
  ? (ENV_API_BASE.endsWith('/api') ? ENV_API_BASE : `${ENV_API_BASE}/api`)
  : '/api';

interface BackendTicket {
  id: string;
  title: string;
  description?: string;
  generated_content?: string;
  notes?: string;
  status: 'icebox' | 'todo' | 'progress' | 'review' | 'done';
  assignee?: string;
  version?: string;
  priority?: 'low' | 'medium' | 'high';
  gitlab_issue_id?: string;
  gitlab_issue_number?: number;
  custom_fields?: Record<string, string | null>;
  created_at: string;
  updated_at: string;
}

interface BackendProjectField {
  id: string;
  project_key: string;
  name: string;
  type: ProjectFieldType;
  options?: string[];
  show_on_board?: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

function mapTicket(ticket: BackendTicket): Ticket {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    generatedContent: ticket.generated_content,
    notes: ticket.notes,
    status: ticket.status,
    assignee: ticket.assignee,
    version: ticket.version,
    priority: ticket.priority,
    gitlabIssueId: ticket.gitlab_issue_id,
    gitlabIssueNumber: ticket.gitlab_issue_number,
    customFields: ticket.custom_fields || {},
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
  };
}

function mapProjectField(field: BackendProjectField): ProjectField {
  return {
    id: field.id,
    projectKey: field.project_key,
    name: field.name,
    type: field.type,
    options: Array.isArray(field.options) ? field.options : [],
    showOnBoard: Boolean(field.show_on_board),
    orderIndex: field.order_index,
    createdAt: field.created_at,
    updatedAt: field.updated_at,
  };
}

function mapTicketPatch(data: UpdateTicketInput): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...data };

  if (Object.prototype.hasOwnProperty.call(payload, 'gitlabIssueId')) {
    payload.gitlab_issue_id = payload.gitlabIssueId;
    delete payload.gitlabIssueId;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'gitlabIssueNumber')) {
    payload.gitlab_issue_number = payload.gitlabIssueNumber;
    delete payload.gitlabIssueNumber;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'customFields')) {
    payload.custom_fields = payload.customFields;
    delete payload.customFields;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'generatedContent')) {
    payload.generated_content = payload.generatedContent;
    delete payload.generatedContent;
  }

  return payload;
}

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json() as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `${fallback}. API at ${API_BASE} returned ${res.status} ${contentType || 'non-JSON'} — is the MyBA worker running?`
    );
  }

  try {
    return await res.json() as T;
  } catch {
    throw new Error(
      `${fallback}. API at ${API_BASE} returned invalid JSON — is the MyBA worker running on the expected port?`
    );
  }
}

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  generatedContent?: string;
  notes?: string;
  status: 'icebox' | 'todo' | 'progress' | 'review' | 'done';
  assignee?: string;
  version?: string;
  priority?: 'low' | 'medium' | 'high';
  gitlabIssueId?: string;
  gitlabIssueNumber?: number;
  customFields?: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
}

export type ProjectFieldType = 'text' | 'select' | 'boolean' | 'number' | 'date';

export interface ProjectField {
  id: string;
  projectKey: string;
  name: string;
  type: ProjectFieldType;
  options: string[];
  showOnBoard: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  title: string;
  description?: string;
  notes?: string;
  status?: Ticket['status'];
  assignee?: string;
  version?: string;
  priority?: Ticket['priority'];
  customFields?: Record<string, string | number | boolean | null>;
}

export interface UpdateTicketInput extends Partial<CreateTicketInput> {
  gitlabIssueId?: string | null;
  gitlabIssueNumber?: number | null;
  generatedContent?: string;
  notes?: string;
}

export interface CreateProjectFieldInput {
  name: string;
  type: ProjectFieldType;
  options?: string[];
  showOnBoard?: boolean;
}

export interface UpdateProjectFieldInput extends Partial<CreateProjectFieldInput> {}

function withTicketContext(token: string, projectKey: string, includeJson = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Project-Key': projectKey,
  };

  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

// Tickets API
export const ticketsApi = {
  async getAll(token: string, projectKey: string): Promise<Ticket[]> {
    const res = await fetch(`${API_BASE}/tickets`, {
      headers: withTicketContext(token, projectKey),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to fetch tickets'));
    const data = await readJson<BackendTicket[]>(res, 'Failed to fetch tickets');
    return data.map(mapTicket);
  },

  async getById(id: string, token: string, projectKey: string): Promise<Ticket> {
    const res = await fetch(`${API_BASE}/tickets/${id}`, {
      headers: withTicketContext(token, projectKey),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to fetch ticket'));
    return mapTicket(await res.json() as BackendTicket);
  },

  async create(data: CreateTicketInput, token: string, projectKey: string): Promise<Ticket> {
    const res = await fetch(`${API_BASE}/tickets`, {
      method: 'POST',
      headers: withTicketContext(token, projectKey, true),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to create ticket'));
    return mapTicket(await res.json() as BackendTicket);
  },

  async update(id: string, data: UpdateTicketInput, token: string, projectKey: string): Promise<Ticket> {
    const res = await fetch(`${API_BASE}/tickets/${id}`, {
      method: 'PUT',
      headers: withTicketContext(token, projectKey, true),
      body: JSON.stringify(mapTicketPatch(data)),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to update ticket'));
    return mapTicket(await res.json() as BackendTicket);
  },

  async delete(id: string, token: string, projectKey: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tickets/${id}`, {
      method: 'DELETE',
      headers: withTicketContext(token, projectKey),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to delete ticket'));
  },

  async importLocalToProject(token: string, targetProjectKey: string): Promise<{ moved: number; targetProjectKey: string }> {
    const res = await fetch(`${API_BASE}/tickets/import-local`, {
      method: 'POST',
      headers: withTicketContext(token, targetProjectKey),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to import local tickets'));
    return res.json();
  },

  async getFields(token: string, projectKey: string): Promise<ProjectField[]> {
    const res = await fetch(`${API_BASE}/tickets/fields`, {
      headers: withTicketContext(token, projectKey),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to fetch custom fields'));
    const data = await res.json() as BackendProjectField[];
    return data.map(mapProjectField);
  },

  async createField(data: CreateProjectFieldInput, token: string, projectKey: string): Promise<ProjectField> {
    const res = await fetch(`${API_BASE}/tickets/fields`, {
      method: 'POST',
      headers: withTicketContext(token, projectKey, true),
      body: JSON.stringify({
        name: data.name,
        type: data.type,
        options: data.options,
        show_on_board: data.showOnBoard,
      }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to create custom field'));
    return mapProjectField(await res.json() as BackendProjectField);
  },

  async updateField(fieldId: string, data: UpdateProjectFieldInput, token: string, projectKey: string): Promise<ProjectField> {
    const res = await fetch(`${API_BASE}/tickets/fields/${fieldId}`, {
      method: 'PUT',
      headers: withTicketContext(token, projectKey, true),
      body: JSON.stringify({
        name: data.name,
        type: data.type,
        options: data.options,
        show_on_board: data.showOnBoard,
      }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to update custom field'));
    return mapProjectField(await res.json() as BackendProjectField);
  },

  async deleteField(fieldId: string, token: string, projectKey: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tickets/fields/${fieldId}`, {
      method: 'DELETE',
      headers: withTicketContext(token, projectKey),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to delete custom field'));
  },

  async reorderFields(fieldIds: string[], token: string, projectKey: string): Promise<ProjectField[]> {
    const res = await fetch(`${API_BASE}/tickets/fields/reorder`, {
      method: 'PUT',
      headers: withTicketContext(token, projectKey, true),
      body: JSON.stringify({ field_ids: fieldIds }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to reorder custom fields'));
    const data = await res.json() as BackendProjectField[];
    return data.map(mapProjectField);
  },
};

// AI API
export const aiApi = {
  async generateTitle(description: string): Promise<{ title: string }> {
    const res = await fetch(`${API_BASE}/ai/generate-title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to generate title'));
    return res.json();
  },

  async regenerateContent(description: string, prompt?: string): Promise<{ content: string }> {
    const res = await fetch(`${API_BASE}/ai/regenerate-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, prompt }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to regenerate ticket content'));
    return res.json();
  },
};

export interface GitLabRepo {
  id: number;
  name: string;
  fullName: string;
  url: string;
}

export interface GitLabIntegrationStatus {
  connected: boolean;
  repo: GitLabRepo | null;
  connectedAt: string | null;
}

export interface GitLabMember {
  id: number;
  username: string;
  name: string;
  avatarUrl?: string | null;
  webUrl?: string | null;
}

export type GitLabSyncMode = 'update' | 'create';

export interface GitLabSyncResult {
  ticketId: string;
  gitlabIssueId: string;
  gitlabIssueNumber: number;
  gitlabIssueUrl: string;
  generatedContent?: string | null;
}

function withAuth(token: string, includeJson = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

// GitLab API
export const gitlabApi = {
  async getAuthUrl(token: string): Promise<{ url: string }> {
    const res = await fetch(`${API_BASE}/gitlab/auth-url`, {
      headers: withAuth(token),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to get auth URL'));
    return res.json();
  },

  async getIntegration(token: string): Promise<GitLabIntegrationStatus> {
    const res = await fetch(`${API_BASE}/gitlab/integration`, {
      headers: withAuth(token),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to fetch integration status'));
    return res.json();
  },

  async getRepos(token: string): Promise<GitLabRepo[]> {
    const res = await fetch(`${API_BASE}/gitlab/repos`, {
      headers: withAuth(token),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to fetch repos'));
    return res.json();
  },

  async getMembers(token: string): Promise<GitLabMember[]> {
    const res = await fetch(`${API_BASE}/gitlab/members`, {
      headers: withAuth(token),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to fetch GitLab members'));
    return res.json();
  },

  async setRepo(token: string, projectId: number): Promise<{
    connected: true;
    repo: GitLabRepo;
    webhookConfigured?: boolean;
    webhookWarning?: string;
  }> {
    const res = await fetch(`${API_BASE}/gitlab/repo`, {
      method: 'PUT',
      headers: withAuth(token, true),
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to save GitLab repository'));
    return res.json();
  },

  async syncTicket(ticketId: string, token: string, mode: GitLabSyncMode): Promise<GitLabSyncResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch(`${API_BASE}/gitlab/sync/${ticketId}`, {
        method: 'POST',
        headers: withAuth(token, true),
        body: JSON.stringify({ mode }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to sync ticket'));
      return res.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('GitLab sync timed out. Please retry.')
      }
      throw error
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
