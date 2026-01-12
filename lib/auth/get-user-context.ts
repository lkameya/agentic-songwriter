import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './config';

/**
 * User context with userId (authenticated) or sessionId (guest)
 */
export interface UserContext {
  userId?: string;
  sessionId: string;
}

/**
 * Get user context from request
 * Returns userId for authenticated users, sessionId for guests
 */
export async function getUserContext(req: NextRequest): Promise<UserContext> {
  // Check for authenticated session
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    // Authenticated user
    return {
      userId: session.user.id as string,
      sessionId: getOrCreateGuestSessionId(req),
    };
  }

  // Guest user - get or create session ID from cookie
  const sessionId = getOrCreateGuestSessionId(req);
  return {
    sessionId,
  };
}

/**
 * Get or create guest session ID from cookie
 */
function getOrCreateGuestSessionId(req: NextRequest): string {
  const existingSessionId = req.cookies.get('guest_session_id')?.value;

  if (existingSessionId) {
    return existingSessionId;
  }

  // Generate new session ID
  const newSessionId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  return newSessionId;
}

/**
 * Get guest session ID from request cookie (doesn't create if missing)
 */
export function getGuestSessionId(req: NextRequest): string | null {
  return req.cookies.get('guest_session_id')?.value || null;
}
