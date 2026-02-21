-- Migration: Persist generated ticket body and separate user notes
-- Tag: v5

ALTER TABLE tickets ADD COLUMN generated_content TEXT;
ALTER TABLE tickets ADD COLUMN notes TEXT;

UPDATE tickets
SET notes = description
WHERE notes IS NULL
  AND description IS NOT NULL;
