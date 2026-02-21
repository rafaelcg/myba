import { verifyToken } from '@clerk/backend';
import type { Env } from './index';

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
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    throw new AuthError(401, 'unauthorized', 'Authorization token required');
  }

  if (!env.CLERK_SECRET_KEY) {
    throw new AuthError(500, 'auth_not_configured', 'Server auth not configured');
  }

  try {
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    const userId = payload?.sub;

    if (!userId) {
      throw new AuthError(401, 'unauthorized', 'Invalid token');
    }

    return userId;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(401, 'unauthorized', 'Invalid or expired token');
  }
}
