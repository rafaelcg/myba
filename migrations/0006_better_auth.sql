-- Better Auth tables (replaces Clerk) + seed of existing Clerk users.
-- User IDs are the original Clerk IDs so every tickets/gitlab_integrations/
-- project_fields row keyed by user_id keeps working unchanged.
-- Google accounts are pre-linked via their Google subject IDs, so users sign
-- in with the same Google account and land on the same data.

CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL,
  "image" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id")
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id"),
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TEXT,
  "refreshTokenExpiresAt" TEXT,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_userId ON "session" ("userId");
CREATE INDEX IF NOT EXISTS idx_session_token ON "session" ("token");
CREATE INDEX IF NOT EXISTS idx_account_userId ON "account" ("userId");
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON "verification" ("identifier");

-- Seed users migrated from Clerk (dev instance), original IDs preserved.
INSERT OR IGNORE INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt") VALUES
  ('user_31HDrfsLgC6muGIEiFkQ9PBfoYV', 'Rafael Guglielmi', 'rafael.guglielmi@and.digital', 1, NULL, '2026-08-04T23:00:00.000Z', '2026-08-04T23:00:00.000Z'),
  ('user_311FN3EORGDh8T7PaNHBKAChqiI', 'Rafael Guglielmi', 'rafaelcg@gmail.com', 1, NULL, '2026-08-04T23:00:00.000Z', '2026-08-04T23:00:00.000Z'),
  ('user_30xb6M0lO6A5jHznfFbVtutoQ9I', 'Raf Guglielmi', 'rafaelcguk@gmail.com', 1, NULL, '2026-08-04T23:00:00.000Z', '2026-08-04T23:00:00.000Z'),
  ('user_3GttWraE0jGZInSrmV7l55hC2hf', 'Cillian Hynes', 'cillian.hynes@and.digital', 1, NULL, '2026-08-04T23:00:00.000Z', '2026-08-04T23:00:00.000Z'),
  ('user_3FA4Spjz5p2NkGnECQ85MPWERjt', 'Edvárd Földessy', 'foldessyedvard@gmail.com', 1, NULL, '2026-08-04T23:00:00.000Z', '2026-08-04T23:00:00.000Z'),
  ('user_3Gwl3VBMABLpbqqXLvEJIa74e0a', 'hynesy23', 'hynesy23@hotmail.com', 1, NULL, '2026-08-04T23:00:00.000Z', '2026-08-04T23:00:00.000Z');

-- Pre-linked Google accounts (accountId = Google subject from Clerk export).
INSERT OR IGNORE INTO "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES
  ('seed_google_1', '111957857608409360608', 'google', 'user_31HDrfsLgC6muGIEiFkQ9PBfoYV', '2026-08-04T23:00:00.000Z', '2026-08-04T23:00:00.000Z'),
  ('seed_google_2', '115680607581687785024', 'google', 'user_311FN3EORGDh8T7PaNHBKAChqiI', '2026-08-04T23:00:00.000Z', '2026-08-04T23:00:00.000Z'),
  ('seed_google_3', '106925240422209937416', 'google', 'user_30xb6M0lO6A5jHznfFbVtutoQ9I', '2026-08-04T23:00:00.000Z', '2026-08-04T23:00:00.000Z'),
  ('seed_google_4', '100870266609771878368', 'google', 'user_3GttWraE0jGZInSrmV7l55hC2hf', '2026-08-04T23:00:00.000Z', '2026-08-04T23:00:00.000Z'),
  ('seed_google_5', '113868966193710533446', 'google', 'user_3FA4Spjz5p2NkGnECQ85MPWERjt', '2026-08-04T23:00:00.000Z', '2026-08-04T23:00:00.000Z');
