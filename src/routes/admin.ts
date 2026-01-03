import { Hono } from 'hono';
import { z } from 'zod';
import { checkAuth, checkRole, invalidateUserCache, type AuthVariables } from '../middleware/auth';
import prisma, { isPrismaError, Role } from '../lib/prisma';

const app = new Hono<{ Variables: AuthVariables }>();

const roleSchema = z.object({ role: z.enum(['USER', 'ASSISTANT', 'ADMIN']) });
const updateSchema = z.object({
    email: z.string().email().optional(),
    role: z.enum(['USER', 'ASSISTANT', 'ADMIN']).optional()
});

// Transform Prisma user to frontend format (id -> _id)
const transformUser = (user: { id: string; clerkId: string; email: string; role: Role }) => ({
    _id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    role: user.role
});

app.get('/users', checkAuth, checkRole('ADMIN'), async (c) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, clerkId: true, email: true, role: true }
        });
        return c.json(users.map(transformUser));
    } catch (error) {
        console.error('Failed to fetch users:', error);
        return c.json({ error: 'Failed to fetch users' }, 500);
    }
});

app.put('/update/:id/role', checkAuth, checkRole('ADMIN'), async (c) => {
    try {
        const id = c.req.param('id');
        if (!id) return c.json({ error: 'User ID is required' }, 400);
        const validatedData = roleSchema.parse(await c.req.json());

        const user = await prisma.user.update({
            where: { id },
            data: { role: validatedData.role as Role },
            select: { id: true, clerkId: true, email: true, role: true }
        });

        invalidateUserCache(user.clerkId);
        return c.json(user);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Invalid role data', details: error.issues }, 400);
        }
        if (isPrismaError(error) && error.code === 'P2025') {
            return c.json({ error: 'User not found' }, 404);
        }
        console.error('Failed to update user role:', error);
        return c.json({ error: 'Failed to update user role' }, 500);
    }
});

app.post('/create/:id/role', checkAuth, checkRole('ADMIN'), async (c) => {
    try {
        const id = c.req.param('id');
        if (!id) return c.json({ error: 'User ID is required' }, 400);
        const validatedData = roleSchema.parse(await c.req.json());

        const user = await prisma.user.update({
            where: { id },
            data: { role: validatedData.role as Role },
            select: { id: true, clerkId: true, email: true, role: true }
        });

        invalidateUserCache(user.clerkId);
        return c.json(transformUser(user));
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Invalid role data', details: error.issues }, 400);
        }
        if (isPrismaError(error) && error.code === 'P2025') {
            return c.json({ error: 'User not found' }, 404);
        }
        console.error('Failed to update user role:', error);
        return c.json({ error: 'Failed to update user role' }, 500);
    }
});

app.get('/users/:id', checkAuth, checkRole('ADMIN'), async (c) => {
    try {
        const id = c.req.param('id');
        if (!id) return c.json({ error: 'User ID is required' }, 400);

        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, clerkId: true, email: true, role: true }
        });

        if (!user) return c.json({ error: 'User not found' }, 404);
        return c.json(transformUser(user));
    } catch (error) {
        console.error('Failed to fetch user:', error);
        return c.json({ error: 'Failed to fetch user' }, 500);
    }
});

app.put('/users/:id', checkAuth, checkRole('ADMIN'), async (c) => {
    try {
        const id = c.req.param('id');
        if (!id) return c.json({ error: 'User ID is required' }, 400);

        const validatedData = updateSchema.parse(await c.req.json());

        const data: Partial<{ email: string; role: Role }> = {};
        if (validatedData.email !== undefined) data.email = validatedData.email;
        if (validatedData.role !== undefined) data.role = validatedData.role as Role;

        const user = await prisma.user.update({
            where: { id },
            data,
            select: { id: true, clerkId: true, email: true, role: true }
        });

        if (validatedData.role) {
            invalidateUserCache(user.clerkId);
        }

        return c.json(transformUser(user));
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Invalid user data', details: error.issues }, 400);
        }
        if (isPrismaError(error) && error.code === 'P2025') {
            return c.json({ error: 'User not found' }, 404);
        }
        console.error('Failed to update user:', error);
        return c.json({ error: 'Failed to update user' }, 500);
    }
});

app.delete('/users/:id', checkAuth, checkRole('ADMIN'), async (c) => {
    try {
        const id = c.req.param('id');
        if (!id) return c.json({ error: 'User ID is required' }, 400);

        const user = await prisma.user.delete({ where: { id } });
        invalidateUserCache(user.clerkId);

        return c.body(null, 204);
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2025') {
            return c.json({ error: 'User not found' }, 404);
        }
        console.error('Failed to delete user:', error);
        return c.json({ error: 'Failed to delete user' }, 500);
    }
});

export default app;