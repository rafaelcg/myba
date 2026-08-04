import type { Env } from './index';
import { getAuth } from './betterAuth';

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function requireUserId(request: Request, env: Env): Promise<string> {
  if (!env.BETTER_AUTH_SECRET) {
    throw new AuthError(500, 'auth_not_configured', 'Server auth not configured');
  }

  try {
    const session = await getAuth(env).api.getSession({ headers: request.headers });
    if (session?.user?.id) {
      return session.user.id;
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
  }

  throw new AuthError(401, 'unauthorized', 'Sign-in required');
}
