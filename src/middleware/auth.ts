import { clerkClient } from '@clerk/clerk-sdk-node';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models';

interface AuthRequest extends Request {
  auth?: {
    userId: string;
    user?: any;
  };
}

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
      const payload = await clerkClient.verifyToken(sessionToken);
      
      if (!payload || !payload.sub) {
        res.status(401).json({ error: 'Unauthorized: Invalid session' });
        return;
      }

      const userId = payload.sub;

      let user = await User.findOne({ clerkId: userId });
      
      if (!user) {
        const clerkUser = await clerkClient.users.getUser(userId);
        
        user = await User.create({
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          role: 'user'
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