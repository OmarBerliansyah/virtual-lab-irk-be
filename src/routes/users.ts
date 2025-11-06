import { Router, Request, Response } from 'express';
import { checkAuth, AuthRequest } from '../middleware/auth';
import { User } from '../models';

const router = Router();

router.get('/profile', checkAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.auth?.user;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profile', checkAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.auth?.user?._id;

    if (!userId) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { email } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { email },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: updatedUser._id,
        clerkId: updatedUser.clerkId,
        email: updatedUser.email,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;