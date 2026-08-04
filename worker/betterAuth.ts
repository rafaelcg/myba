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
      sendResetPassword: async ({ user, url }) => {
        await env.EMAIL.send({
          to: user.email,
          from: { email: 'noreply@mail.generate.ac', name: 'MyBA' },
          subject: 'Reset your MyBA password',
          html: [
            '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px">',
            '<h2 style="color:#2c3e50;margin:0 0 12px">Reset your password</h2>',
            `<p style="color:#475569;font-size:14px;line-height:1.6">Hi ${user.name || 'there'}, we received a request to reset your MyBA password. This link expires in 1 hour.</p>`,
            `<p style="margin:24px 0"><a href="${url}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Reset password</a></p>`,
            `<p style="color:#94a3b8;font-size:12px;line-height:1.6">If the button doesn't work, paste this link into your browser:<br>${url}</p>`,
            '<p style="color:#94a3b8;font-size:12px">Didn\'t request this? You can safely ignore this email.</p>',
            '</div>',
          ].join(''),
          text: `Reset your MyBA password (link expires in 1 hour):\n\n${url}\n\nIf you didn't request this, you can safely ignore this email.`,
        });
      },
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
      'https://generate.ac',
      'https://www.generate.ac',
      'https://sprintflow-beta.pages.dev',
    ],
  });

  return auth;
}
