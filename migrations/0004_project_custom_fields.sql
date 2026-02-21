-- Project-scoped custom fields and per-ticket custom field values

CREATE TABLE IF NOT EXISTS project_fields (
  id TEXT PRIMARY KEY,
  project_key TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  options_json TEXT,
  show_on_board INTEGER DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_field_values (
  ticket_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  value_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ticket_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_project_fields_project_order
  ON project_fields(project_key, order_index);

CREATE INDEX IF NOT EXISTS idx_ticket_field_values_field
  ON ticket_field_values(field_id);
