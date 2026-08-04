import { betterAuth } from 'better-auth';
import type { Env } from './index';

// Reuse one instance per isolate; env bindings are stable across requests.
let auth: ReturnType<typeof betterAuth> | null = null;

export function getAuth(env: Env) {
  if (auth) return auth;

  const hasGoogle = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  auth = betterAuth({
    baseURL: env.BETTER_AUTH_URL || 'http://localhost:3000',
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: hasGoogle
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {},
    account: {
      accountLinking: {
        enabled: true,
        // Google verifies emails, so link sign-ins to the seeded legacy
        // users (migrated from Clerk with their original IDs) by email.
        trustedProviders: ['google'],
      },
    },
    trustedOrigins: [
      'http://localhost:3000',
      'https://sprintflow-beta.pages.dev',
    ],
  });

  return auth;
}
