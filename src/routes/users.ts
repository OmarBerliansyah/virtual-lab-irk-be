import { Hono } from 'hono';
import prisma from '../lib/prisma';
import { checkAuth, type AuthVariables } from '../middleware/auth';

const app = new Hono<{ Variables: AuthVariables }>();

app.get('/profile', checkAuth, async (c) => {
  try {
    const user = c.get('auth')?.user;

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user: {
        _id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.put('/profile', checkAuth, async (c) => {
  try {
    const userId = c.get('auth')?.user?.id;

    if (!userId) {
      return c.json({ error: 'User not found' }, 404);
    }

    const { email } = await c.req.json();

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { email }
    });

    if (!updatedUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user: {
        _id: updatedUser.id,
        clerkId: updatedUser.clerkId,
        email: updatedUser.email,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;