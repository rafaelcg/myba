import { Env } from '../index';
import { AuthError, requireUserId } from '../auth';

export interface TicketRecord {
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
  created_at: string;
  updated_at: string;
}

export interface Ticket extends TicketRecord {
  custom_fields?: Record<string, string | null>;
}

interface ProjectFieldRow {
  id: string;
  project_key: string;
  user_id?: string | null;
  name: string;
  type: 'text' | 'select' | 'boolean' | 'number' | 'date';
  options_json?: string | null;
  show_on_board: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface ProjectFieldResponse {
  id: string;
  project_key: string;
  name: string;
  type: 'text' | 'select' | 'boolean' | 'number' | 'date';
  options: string[];
  show_on_board: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const FIELD_TYPES = new Set(['text', 'select', 'boolean', 'number', 'date']);

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

function asRouteError(error: unknown): RouteError {
  if (error instanceof RouteError) {
    return error;
  }
  if (error instanceof AuthError) {
    return new RouteError(error.status, error.code, error.message);
  }
  return new RouteError(500, 'internal_error', 'Unexpected server error');
}

function getProjectKey(request: Request): string {
  const value = request.headers.get('x-project-key')?.trim();
  if (!value) {
    return 'local';
  }

  if (value.length > 128) {
    throw new RouteError(400, 'invalid_project_key', 'Project key is too long');
  }

  return value;
}

function parseGitLabRepoId(projectKey: string): number | null {
  const match = /^gitlab:(\d+)$/.exec(projectKey);
  if (!match) {
    return null;
  }

  const repoId = Number.parseInt(match[1], 10);
  if (!Number.isFinite(repoId) || repoId <= 0) {
    return null;
  }

  return repoId;
}

async function ensureProjectAccess(env: Env, userId: string, projectKey: string): Promise<{ shared: boolean }> {
  const gitlabRepoId = parseGitLabRepoId(projectKey);
  if (!gitlabRepoId) {
    return { shared: false };
  }

  const access = await env.DB.prepare(
    'SELECT 1 as allowed FROM gitlab_integrations WHERE user_id = ? AND repo_id = ? LIMIT 1'
  ).bind(userId, gitlabRepoId).first<{ allowed: number }>();

  if (!access?.allowed) {
    throw new RouteError(403, 'project_forbidden', 'You do not have access to this project');
  }

  return { shared: true };
}

function getScopeFilter(projectKey: string, userId: string, shared: boolean): {
  where: string;
  bindings: (string | number)[];
} {
  if (shared) {
    return {
      where: 'project_key = ?',
      bindings: [projectKey],
    };
  }

  return {
    where: 'user_id = ? AND project_key = ?',
    bindings: [userId, projectKey],
  };
}

function parseFieldType(input: unknown): ProjectFieldRow['type'] {
  if (typeof input !== 'string') {
    throw new RouteError(400, 'invalid_field_type', 'Field type is required');
  }

  const normalized = input.trim().toLowerCase();
  if (!FIELD_TYPES.has(normalized)) {
    throw new RouteError(400, 'invalid_field_type', 'Unsupported field type');
  }

  return normalized as ProjectFieldRow['type'];
}

function parseFieldOptions(input: unknown, required: boolean): string[] {
  if (input === undefined || input === null) {
    if (required) {
      throw new RouteError(400, 'invalid_field_options', 'Select fields require at least one option');
    }
    return [];
  }

  const values = Array.isArray(input)
    ? input
    : String(input)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

  const normalized = Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));

  if (required && normalized.length === 0) {
    throw new RouteError(400, 'invalid_field_options', 'Select fields require at least one option');
  }

  return normalized;
}

function parseFieldOptionsFromRow(row: ProjectFieldRow): string[] {
  if (!row.options_json) {
    return [];
  }

  try {
    const parsed = JSON.parse(row.options_json);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => String(value).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function toProjectFieldResponse(row: ProjectFieldRow): ProjectFieldResponse {
  return {
    id: row.id,
    project_key: row.project_key,
    name: row.name,
    type: row.type,
    options: parseFieldOptionsFromRow(row),
    show_on_board: Boolean(row.show_on_board),
    order_index: row.order_index,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeCustomFieldValue(
  rawValue: unknown,
  field: ProjectFieldRow,
): string | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (field.type === 'boolean') {
    if (typeof rawValue === 'boolean') {
      return rawValue ? 'true' : 'false';
    }

    const asText = String(rawValue).trim().toLowerCase();
    if (asText === '' || asText === '-') {
      return null;
    }
    if (['true', '1', 'yes'].includes(asText)) {
      return 'true';
    }
    if (['false', '0', 'no'].includes(asText)) {
      return 'false';
    }
    throw new RouteError(400, 'invalid_custom_field_value', `Invalid boolean value for ${field.name}`);
  }

  if (field.type === 'number') {
    if (typeof rawValue === 'number') {
      if (!Number.isFinite(rawValue)) {
        throw new RouteError(400, 'invalid_custom_field_value', `Invalid number value for ${field.name}`);
      }
      return String(rawValue);
    }

    const asText = String(rawValue).trim();
    if (!asText || asText === '-') {
      return null;
    }

    const numeric = Number(asText);
    if (!Number.isFinite(numeric)) {
      throw new RouteError(400, 'invalid_custom_field_value', `Invalid number value for ${field.name}`);
    }

    return String(numeric);
  }

  const asText = String(rawValue).trim();
  if (!asText || asText === '-') {
    return null;
  }

  if (field.type === 'date') {
    const parsed = Date.parse(asText);
    if (Number.isNaN(parsed)) {
      throw new RouteError(400, 'invalid_custom_field_value', `Invalid date value for ${field.name}`);
    }
    return asText;
  }

  if (field.type === 'select') {
    const allowed = parseFieldOptionsFromRow(field);
    if (allowed.length > 0 && !allowed.includes(asText)) {
      throw new RouteError(400, 'invalid_custom_field_value', `Invalid option for ${field.name}`);
    }
    return asText;
  }

  return asText;
}

function getProjectFieldScopeFilter(projectKey: string, _userId: string, _shared: boolean): {
  where: string;
  bindings: (string | number | null)[];
} {
  return {
    where: 'project_key = ?',
    bindings: [projectKey],
  };
}

async function listProjectFields(env: Env, projectKey: string, userId: string, shared: boolean): Promise<ProjectFieldRow[]> {
  const scope = getProjectFieldScopeFilter(projectKey, userId, shared);
  const { results } = await env.DB.prepare(`
    SELECT *
    FROM project_fields
    WHERE ${scope.where}
    ORDER BY order_index ASC, created_at ASC
  `).bind(...scope.bindings).all<ProjectFieldRow>();

  return results || [];
}

async function getProjectFieldById(
  env: Env,
  projectKey: string,
  userId: string,
  shared: boolean,
  fieldId: string,
): Promise<ProjectFieldRow | null> {
  const scope = getProjectFieldScopeFilter(projectKey, userId, shared);
  return env.DB.prepare(`
    SELECT *
    FROM project_fields
    WHERE id = ? AND ${scope.where}
    LIMIT 1
  `).bind(fieldId, ...scope.bindings).first<ProjectFieldRow>();
}

async function normalizeCustomFieldPayload(
  env: Env,
  projectKey: string,
  userId: string,
  shared: boolean,
  payload: unknown,
): Promise<Record<string, string | null>> {
  if (payload === undefined) {
    return {};
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RouteError(400, 'invalid_custom_fields', 'custom_fields must be an object');
  }

  const fields = await listProjectFields(env, projectKey, userId, shared);
  const fieldsById = new Map(fields.map((field) => [field.id, field] as const));

  const normalized: Record<string, string | null> = {};

  for (const [fieldId, rawValue] of Object.entries(payload as Record<string, unknown>)) {
    const field = fieldsById.get(fieldId);
    if (!field) {
      throw new RouteError(400, 'unknown_custom_field', `Unknown custom field ${fieldId}`);
    }

    normalized[fieldId] = normalizeCustomFieldValue(rawValue, field);
  }

  return normalized;
}

async function upsertTicketCustomFields(
  env: Env,
  ticketId: string,
  customFields: Record<string, string | null>,
): Promise<void> {
  const now = new Date().toISOString();

  for (const [fieldId, value] of Object.entries(customFields)) {
    if (value === null) {
      await env.DB.prepare(`
        DELETE FROM ticket_field_values
        WHERE ticket_id = ? AND field_id = ?
      `).bind(ticketId, fieldId).run();
      continue;
    }

    await env.DB.prepare(`
      INSERT INTO ticket_field_values (ticket_id, field_id, value_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(ticket_id, field_id)
      DO UPDATE SET value_text = excluded.value_text, updated_at = excluded.updated_at
    `).bind(ticketId, fieldId, value, now, now).run();
  }
}

async function attachCustomFieldsToTickets(
  env: Env,
  projectKey: string,
  userId: string,
  shared: boolean,
  tickets: TicketRecord[],
): Promise<Ticket[]> {
  if (!tickets.length) {
    return [];
  }

  const ticketIds = tickets.map((ticket) => ticket.id);
  const placeholders = ticketIds.map(() => '?').join(', ');

  const fieldScope = getProjectFieldScopeFilter(projectKey, userId, shared);
  const { results } = await env.DB.prepare(`
    SELECT tfv.ticket_id, tfv.field_id, tfv.value_text
    FROM ticket_field_values tfv
    JOIN project_fields pf ON pf.id = tfv.field_id
    WHERE ${fieldScope.where} AND tfv.ticket_id IN (${placeholders})
  `).bind(...fieldScope.bindings, ...ticketIds).all<{ ticket_id: string; field_id: string; value_text: string | null }>();

  const byTicketId = new Map<string, Record<string, string | null>>();

  for (const row of results || []) {
    const existing = byTicketId.get(row.ticket_id) || {};
    existing[row.field_id] = row.value_text;
    byTicketId.set(row.ticket_id, existing);
  }

  return tickets.map((ticket) => ({
    ...ticket,
    custom_fields: byTicketId.get(ticket.id) || {},
  }));
}

async function getTicketWithCustomFields(
  env: Env,
  projectKey: string,
  userId: string,
  shared: boolean,
  scopeWhere: string,
  scopeBindings: (string | number)[],
  ticketId: string,
): Promise<Ticket | null> {
  const ticket = await env.DB.prepare(
    `SELECT * FROM tickets WHERE id = ? AND ${scopeWhere}`
  ).bind(ticketId, ...scopeBindings).first<TicketRecord>();

  if (!ticket) {
    return null;
  }

  const [hydrated] = await attachCustomFieldsToTickets(env, projectKey, userId, shared, [ticket]);
  return hydrated;
}

export const ticketsHandler = {
  // GET /api/tickets/fields
  async listFields(request: Request, env: Env): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const projectKey = getProjectKey(request);
      const { shared } = await ensureProjectAccess(env, userId, projectKey);

      const fields = await listProjectFields(env, projectKey, userId, shared);
      return jsonResponse(fields.map(toProjectFieldResponse));
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // POST /api/tickets/fields
  async createField(request: Request, env: Env): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const projectKey = getProjectKey(request);
      const { shared } = await ensureProjectAccess(env, userId, projectKey);

      const body = await request.json() as Record<string, unknown>;
      const name = String(body.name || '').trim();
      if (!name) {
        return errorResponse(400, 'field_name_required', 'Field name is required');
      }
      if (name.length > 64) {
        return errorResponse(400, 'field_name_too_long', 'Field name is too long');
      }

      const type = parseFieldType(body.type || 'text');
      const options = type === 'select'
        ? parseFieldOptions(body.options, true)
        : [];

      const showOnBoard = body.show_on_board ?? body.showOnBoard;
      const showOnBoardValue = showOnBoard ? 1 : 0;
      const fieldScope = getProjectFieldScopeFilter(projectKey, userId, shared);

      const nextOrderRow = await env.DB.prepare(`
        SELECT COALESCE(MAX(order_index), -1) AS max_order
        FROM project_fields
        WHERE ${fieldScope.where}
      `).bind(...fieldScope.bindings).first<{ max_order: number | null }>();

      const nextOrder = Number(nextOrderRow?.max_order ?? -1) + 1;
      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO project_fields (
          id,
          project_key,
          name,
          type,
          options_json,
          show_on_board,
          order_index,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        projectKey,
        name,
        type,
        options.length ? JSON.stringify(options) : null,
        showOnBoardValue,
        nextOrder,
        now,
        now,
      ).run();

      const field = await getProjectFieldById(env, projectKey, userId, shared, id);
      return jsonResponse(field ? toProjectFieldResponse(field) : null, 201);
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // PUT /api/tickets/fields/reorder
  async reorderFields(request: Request, env: Env): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const projectKey = getProjectKey(request);
      const { shared } = await ensureProjectAccess(env, userId, projectKey);

      const body = await request.json() as Record<string, unknown>;
      const provided = (body.field_ids || body.fieldIds) as unknown;
      if (!Array.isArray(provided)) {
        return errorResponse(400, 'field_ids_required', 'field_ids must be an array');
      }

      const fieldIds = provided.map((value) => String(value));
      const uniqueIds = new Set(fieldIds);
      if (uniqueIds.size !== fieldIds.length) {
        return errorResponse(400, 'duplicate_field_ids', 'field_ids contains duplicates');
      }

      const existing = await listProjectFields(env, projectKey, userId, shared);
      if (existing.length !== fieldIds.length) {
        return errorResponse(400, 'invalid_field_ids', 'field_ids must include every field exactly once');
      }

      const existingIds = new Set(existing.map((field) => field.id));
      for (const fieldId of fieldIds) {
        if (!existingIds.has(fieldId)) {
          return errorResponse(400, 'invalid_field_ids', `Unknown field id: ${fieldId}`);
        }
      }

      const now = new Date().toISOString();
      const scope = getProjectFieldScopeFilter(projectKey, userId, shared);
      for (let index = 0; index < fieldIds.length; index += 1) {
        await env.DB.prepare(`
          UPDATE project_fields
          SET order_index = ?, updated_at = ?
          WHERE id = ? AND ${scope.where}
        `).bind(index, now, fieldIds[index], ...scope.bindings).run();
      }

      const reordered = await listProjectFields(env, projectKey, userId, shared);
      return jsonResponse(reordered.map(toProjectFieldResponse));
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // PUT /api/tickets/fields/:id
  async updateField(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const projectKey = getProjectKey(request);
      const { shared } = await ensureProjectAccess(env, userId, projectKey);

      const field = await getProjectFieldById(env, projectKey, userId, shared, params.id);
      if (!field) {
        return errorResponse(404, 'field_not_found', 'Field not found');
      }
      const fieldScope = getProjectFieldScopeFilter(projectKey, userId, shared);

      const body = await request.json() as Record<string, unknown>;
      const updates: string[] = [];
      const values: (string | number | null)[] = [];

      let type = field.type;
      if (body.type !== undefined) {
        type = parseFieldType(body.type);
        updates.push('type = ?');
        values.push(type);
      }

      if (body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) {
          return errorResponse(400, 'field_name_required', 'Field name is required');
        }
        if (name.length > 64) {
          return errorResponse(400, 'field_name_too_long', 'Field name is too long');
        }
        updates.push('name = ?');
        values.push(name);
      }

      const shouldUpdateOptions = body.options !== undefined || (body.type !== undefined && type !== field.type);
      if (shouldUpdateOptions) {
        if (type === 'select') {
          const options = parseFieldOptions(body.options, !field.options_json || body.type !== undefined);
          updates.push('options_json = ?');
          values.push(JSON.stringify(options));
        } else {
          updates.push('options_json = ?');
          values.push(null);
        }
      }

      const showOnBoard = body.show_on_board ?? body.showOnBoard;
      if (showOnBoard !== undefined) {
        updates.push('show_on_board = ?');
        values.push(showOnBoard ? 1 : 0);
      }

      if (!updates.length) {
        return errorResponse(400, 'no_fields_to_update', 'No fields to update');
      }

      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(params.id);
      values.push(...fieldScope.bindings);

      await env.DB.prepare(`
        UPDATE project_fields
        SET ${updates.join(', ')}
        WHERE id = ? AND ${fieldScope.where}
      `).bind(...values).run();

      const updatedField = await getProjectFieldById(env, projectKey, userId, shared, params.id);
      return jsonResponse(updatedField ? toProjectFieldResponse(updatedField) : null);
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // DELETE /api/tickets/fields/:id
  async deleteField(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const projectKey = getProjectKey(request);
      const { shared } = await ensureProjectAccess(env, userId, projectKey);
      const fieldScope = getProjectFieldScopeFilter(projectKey, userId, shared);

      const field = await getProjectFieldById(env, projectKey, userId, shared, params.id);
      if (!field) {
        return errorResponse(404, 'field_not_found', 'Field not found');
      }

      await env.DB.prepare(`
        DELETE FROM ticket_field_values
        WHERE field_id = ?
      `).bind(params.id).run();

      await env.DB.prepare(`
        DELETE FROM project_fields
        WHERE id = ? AND ${fieldScope.where}
      `).bind(params.id, ...fieldScope.bindings).run();

      return jsonResponse({ success: true });
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // GET /api/tickets
  async list(request: Request, env: Env): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const projectKey = getProjectKey(request);
      const { shared } = await ensureProjectAccess(env, userId, projectKey);
      const scope = getScopeFilter(projectKey, userId, shared);
      const { results } = await env.DB.prepare(
        `SELECT * FROM tickets WHERE ${scope.where} ORDER BY updated_at DESC`
      ).bind(...scope.bindings).all<TicketRecord>();

      const hydrated = await attachCustomFieldsToTickets(env, projectKey, userId, shared, results || []);
      return jsonResponse(hydrated);
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // POST /api/tickets/import-local
  async importLocal(request: Request, env: Env): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const targetProjectKey = getProjectKey(request);

      if (targetProjectKey === 'local') {
        return errorResponse(400, 'invalid_target_project', 'Select a non-local project before importing');
      }

      await ensureProjectAccess(env, userId, targetProjectKey);

      const now = new Date().toISOString();
      const result = await env.DB.prepare(`
        UPDATE tickets
        SET project_key = ?, updated_at = ?
        WHERE user_id = ? AND project_key = 'local'
      `).bind(targetProjectKey, now, userId).run();

      const moved = Number(result.meta.changes || 0);
      return jsonResponse({ moved, targetProjectKey });
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // GET /api/tickets/:id
  async get(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const projectKey = getProjectKey(request);
      const { shared } = await ensureProjectAccess(env, userId, projectKey);
      const scope = getScopeFilter(projectKey, userId, shared);
      const ticket = await getTicketWithCustomFields(env, projectKey, userId, shared, scope.where, scope.bindings, params.id);

      if (!ticket) {
        return errorResponse(404, 'ticket_not_found', 'Ticket not found');
      }

      return jsonResponse(ticket);
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // POST /api/tickets
  async create(request: Request, env: Env): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const projectKey = getProjectKey(request);
      const { shared } = await ensureProjectAccess(env, userId, projectKey);
      const scope = getScopeFilter(projectKey, userId, shared);
      const body = await request.json() as Partial<TicketRecord> & { custom_fields?: unknown; customFields?: unknown };

      if (!body.title) {
        return errorResponse(400, 'title_required', 'Title is required');
      }

      const customFieldsPayload = body.custom_fields ?? body.customFields;
      const normalizedCustomFields = await normalizeCustomFieldPayload(env, projectKey, userId, shared, customFieldsPayload);

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO tickets (
          id, user_id, project_key, title, description, generated_content, notes, status, assignee, version, priority, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        userId,
        projectKey,
        body.title,
        body.description || null,
        body.generated_content || null,
        body.notes || null,
        body.status || 'todo',
        body.assignee || null,
        body.version || null,
        body.priority || 'medium',
        now,
        now
      ).run();

      await upsertTicketCustomFields(env, id, normalizedCustomFields);

      const ticket = await getTicketWithCustomFields(env, projectKey, userId, shared, scope.where, scope.bindings, id);
      return jsonResponse(ticket, 201);
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // PUT /api/tickets/:id
  async update(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const projectKey = getProjectKey(request);
      const { shared } = await ensureProjectAccess(env, userId, projectKey);
      const scope = getScopeFilter(projectKey, userId, shared);
      const body = await request.json() as Partial<TicketRecord> & { custom_fields?: unknown; customFields?: unknown };
      const now = new Date().toISOString();

      const existing = await env.DB.prepare(`
        SELECT id FROM tickets WHERE id = ? AND ${scope.where}
      `).bind(params.id, ...scope.bindings).first<{ id: string }>();

      if (!existing) {
        return errorResponse(404, 'ticket_not_found', 'Ticket not found');
      }

      const customFieldsPayload = body.custom_fields ?? body.customFields;
      const hasCustomFields = Object.prototype.hasOwnProperty.call(body, 'custom_fields')
        || Object.prototype.hasOwnProperty.call(body, 'customFields');
      const normalizedCustomFields = hasCustomFields
        ? await normalizeCustomFieldPayload(env, projectKey, userId, shared, customFieldsPayload)
        : {};

      // Build dynamic update query
      const updates: string[] = [];
      const values: (string | number | null)[] = [];

      if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title); }
      if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
      if (body.generated_content !== undefined) { updates.push('generated_content = ?'); values.push(body.generated_content ?? null); }
      if (body.notes !== undefined) { updates.push('notes = ?'); values.push(body.notes ?? null); }
      if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }
      if (body.assignee !== undefined) { updates.push('assignee = ?'); values.push(body.assignee); }
      if (body.version !== undefined) { updates.push('version = ?'); values.push(body.version || null); }
      if (body.priority !== undefined) { updates.push('priority = ?'); values.push(body.priority); }
      if (body.gitlab_issue_id !== undefined) { updates.push('gitlab_issue_id = ?'); values.push(body.gitlab_issue_id); }
      if (body.gitlab_issue_number !== undefined) { updates.push('gitlab_issue_number = ?'); values.push(body.gitlab_issue_number ?? null); }

      if (updates.length === 0 && !hasCustomFields) {
        return errorResponse(400, 'no_fields_to_update', 'No fields to update');
      }

      updates.push('updated_at = ?');
      values.push(now);
      values.push(params.id);
      values.push(...scope.bindings);

      await env.DB.prepare(`
        UPDATE tickets SET ${updates.join(', ')} WHERE id = ? AND ${scope.where}
      `).bind(...values).run();

      if (hasCustomFields) {
        await upsertTicketCustomFields(env, params.id, normalizedCustomFields);
      }

      const ticket = await getTicketWithCustomFields(env, projectKey, userId, shared, scope.where, scope.bindings, params.id);
      return jsonResponse(ticket);
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },

  // DELETE /api/tickets/:id
  async remove(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
    try {
      const userId = await requireUserId(request, env);
      const projectKey = getProjectKey(request);
      const { shared } = await ensureProjectAccess(env, userId, projectKey);
      const scope = getScopeFilter(projectKey, userId, shared);

      await env.DB.prepare(`
        DELETE FROM ticket_field_values
        WHERE ticket_id = ?
      `).bind(params.id).run();

      await env.DB.prepare(`DELETE FROM tickets WHERE id = ? AND ${scope.where}`)
        .bind(params.id, ...scope.bindings)
        .run();

      return jsonResponse({ success: true });
    } catch (error) {
      const routeError = asRouteError(error);
      return errorResponse(routeError.status, routeError.code, routeError.message);
    }
  },
};
