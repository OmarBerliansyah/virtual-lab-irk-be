import { createMiddleware } from 'hono/factory';
import { clerkClient } from '@clerk/clerk-sdk-node';
import prisma, { Role, type PrismaUser } from '../lib/prisma';

// Define the shape of your Context variables
export type AuthVariables = {
  auth: {
    userId: string;
    user?: PrismaUser;
  };
};

// Caching logic
const tokenCache = new Map<string, { userId: string; expiry: number }>();
const userCache = new Map<string, { user: PrismaUser; expiry: number }>();
const CACHE_DURATION = 5 * 60 * 1000;
const USER_CACHE_DURATION = 10 * 60 * 1000;

// Helper to cleanup cache
setInterval(() => {
  const now = Date.now();
  tokenCache.forEach((v, k) => v.expiry < now && tokenCache.delete(k));
  userCache.forEach((v, k) => v.expiry < now && userCache.delete(k));
}, 15 * 60 * 1000);

export const checkAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const sessionToken = authHeader.split(' ')[1];

    if (!sessionToken) {
      return c.json({ error: 'Unauthorized: Invalid token format' }, 401);
    }

    let userId: string;

    // Check token cache first
    const cachedToken = tokenCache.get(sessionToken);
    if (cachedToken && cachedToken.expiry > Date.now()) {
      userId = cachedToken.userId;
    } else {
      try {
        // Verify token with Clerk
        const payload = await clerkClient.verifyToken(sessionToken);

        if (!payload || !payload.sub) {
          return c.json({ error: 'Unauthorized: Invalid session' }, 401);
        }

        userId = payload.sub;

        // Cache the verified token
        tokenCache.set(sessionToken, {
          userId,
          expiry: Date.now() + CACHE_DURATION
        });
      } catch (e) {
        console.error('Clerk verification error:', e);
        return c.json({ error: 'Unauthorized: Invalid token' }, 401);
      }
    }

    let user: PrismaUser | null = null;

    // Check user cache first
    const cachedUser = userCache.get(userId);
    if (cachedUser && cachedUser.expiry > Date.now()) {
      user = cachedUser.user;
    } else {
      // Fetch from database
      user = await prisma.user.findUnique({ where: { clerkId: userId } });

      if (!user) {
        const clerkUser = await clerkClient.users.getUser(userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress || '';

        let role: Role = 'USER';

        // ADMIN whitelisting
        if (email === '18223055@std.stei.itb.ac.id' || email === '18223005@std.stei.itb.ac.id') {
          role = 'ADMIN';
        } else if (email.endsWith('@std.stei.itb.ac.id')) {
          // ASSISTANT whitelisting - check NIM pattern
          const nimMatch = email.match(/^(\d{8})@std\.stei\.itb\.ac\.id$/);
          if (nimMatch && nimMatch[1]) {
            const nim = nimMatch[1];
            const ASSISTANTNIMs = [
              '13522001', '13522002', '13522005', '13522037', '13522052', '13522091', '13522098',
              '13522110', '13522124', '13522137', '13522147', '13522153',
              '13523017', '13523063', '13523069', '13523084', '13523091', '13523094', '13523100',
              '13523115', '13523136', '13523154', '13523158', '13523160'
            ];

            if (ASSISTANTNIMs.includes(nim)) {
              role = 'ASSISTANT';
            }
          }
        }

        user = await prisma.user.create({
          data: {
            clerkId: userId,
            email,
            role
          }
        });
      }

      if (user) {
        userCache.set(userId, {
          user,
          expiry: Date.now() + USER_CACHE_DURATION
        });
      }
    }

    // Set context variable
    c.set('auth', { userId, user: user || undefined });
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export const checkRole = (requiredRole: 'ASSISTANT' | 'ADMIN') => {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const auth = c.get('auth');

    if (!auth?.user) {
      return c.json({ error: 'Unauthorized: User not found' }, 401);
    }

    const userRole = auth.user.role;

    if (userRole === 'ADMIN' || userRole === requiredRole) {
      await next();
    } else {
      return c.json({
        error: 'Forbidden: Insufficient permissions',
        required: requiredRole,
        current: userRole
      }, 403);
    }
  });
};

export const invalidateUserCache = (clerkId: string): void => {
  userCache.delete(clerkId);
  console.log(`User cache invalidated for clerkId: ${clerkId}`);
};