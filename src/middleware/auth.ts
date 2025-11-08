import { clerkClient } from '@clerk/clerk-sdk-node';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models';

interface AuthRequest extends Request {
  auth?: {
    userId: string;
    user?: any;
  };
}

const tokenCache = new Map<string, { userId: string; expiry: number }>();
const CACHE_DURATION = 5 * 60 * 1000;
const userCache = new Map<string, { user: any; expiry: number }>();
const USER_CACHE_DURATION = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  
  for (const [key, value] of tokenCache.entries()) {
    if (value.expiry < now) {
      tokenCache.delete(key);
    }
  }
  
  for (const [key, value] of userCache.entries()) {
    if (value.expiry < now) {
      userCache.delete(key);
    }
  }
}, 15 * 60 * 1000);

export const checkAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    const sessionToken = authHeader.split(' ')[1];
    
    if (!sessionToken) {
      res.status(401).json({ error: 'Unauthorized: Invalid token format' });
      return;
    }
    
    try {
      let userId: string;
      
      // Check token cache first
      const cachedToken = tokenCache.get(sessionToken);
      if (cachedToken && cachedToken.expiry > Date.now()) {
        userId = cachedToken.userId;
      } else {
        // Verify token with Clerk
        const payload = await clerkClient.verifyToken(sessionToken);
        
        if (!payload || !payload.sub) {
          res.status(401).json({ error: 'Unauthorized: Invalid session' });
          return;
        }

        userId = payload.sub;
        
        // Cache the verified token
        tokenCache.set(sessionToken, {
          userId,
          expiry: Date.now() + CACHE_DURATION
        });
      }

      let user: any;
      
      // Check user cache first
      const cachedUser = userCache.get(userId);
      if (cachedUser && cachedUser.expiry > Date.now()) {
        user = cachedUser.user;
      } else {
        // Fetch from database
        user = await User.findOne({ clerkId: userId });
        
        if (!user) {
          const clerkUser = await clerkClient.users.getUser(userId);
          const email = clerkUser.emailAddresses[0]?.emailAddress || '';
          
          let role = 'user';
          
          // Admin whitelisting
          if (email === '18223055@std.stei.itb.ac.id' || email === '18223005@std.stei.itb.ac.id') {
            role = 'admin';
          } 
          // Assistant whitelisting - check NIM pattern
        else if (email.endsWith('@std.stei.itb.ac.id')) {
          const nimMatch = email.match(/^(\d{8})@std\.stei\.itb\.ac\.id$/);
          if (nimMatch && nimMatch[1]) {
            const nim = nimMatch[1];
            // Assistant NIMs from the provided lists
            const assistantNIMs = [
              "13522001", "13522002", "13522005", "13522037", "13522052", "13522091", "13522098", 
              "13522110", "13522124", "13522137", "13522147", "13522153",

              "13523017", "13523063", "13523069", "13523084", "13523091", "13523094", "13523100",
              "13523115", "13523136", "13523154", "13523158", "13523160"
            ];
            
            if (assistantNIMs.includes(nim)) {
              role = 'assistant';
            }
          }
        }
        
          user = await User.create({
            clerkId: userId,
            email,
            role
          });
        }
        
        // Cache the user
        userCache.set(userId, {
          user,
          expiry: Date.now() + USER_CACHE_DURATION
        });
      }

      (req as AuthRequest).auth = {
        userId: userId,
        user: user
      };
      
      next();
    } catch (clerkError) {
      console.error('Clerk verification error:', clerkError);
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkRole = (requiredRole: 'assistant' | 'admin') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    
    if (!authReq.auth?.user) {
      res.status(401).json({ error: 'Unauthorized: User not found' });
      return;
    }

    const userRole = authReq.auth.user.role;
    
    if (userRole === 'admin' || userRole === requiredRole) {
      next();
    } else {
      res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions',
        required: requiredRole,
        current: userRole
      });
    }
  };
};

export type { AuthRequest };