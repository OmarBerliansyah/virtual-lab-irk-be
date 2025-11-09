import { Router, Request, Response } from 'express';
import { User } from '../models';
import { checkAuth, checkRole, invalidateUserCache } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.get('/users', checkAuth, checkRole('admin'), async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await User.find().select('-__v -createdAt -updatedAt');
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.put('/update/:id/role', checkAuth, checkRole('admin'), async (req: Request, res: Response): Promise<void> => {
    try {
        const roleSchema = z.object({
            role: z.enum(['user', 'assistant', 'admin']),
        });
        const validatedData = roleSchema.parse(req.body);
        const user = await User.findByIdAndUpdate(req.params.id, { role: validatedData.role }, { new: true }).select('-__v -createdAt -updatedAt');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        invalidateUserCache(user.clerkId);

        res.json(user);
    } 
    catch (error) {
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

router.post('/create/:id/role', checkAuth, checkRole('admin'), async (req: Request, res: Response): Promise<void> => {
    try {
        const roleSchema = z.object({
            role: z.enum(['user', 'assistant', 'admin']),
        });
        const validatedData = roleSchema.parse(req.body);
        const user = await User.findByIdAndUpdate(req.params.id, { role: validatedData.role }, { new: true }).select('-__v -createdAt -updatedAt');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Invalidate cache for this user when their role changes
        invalidateUserCache(user.clerkId);

        res.json(user);
    } 
    catch (error) {
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

router.get('/users/:id', checkAuth, checkRole('admin'), async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.params.id).select('-__v -createdAt -updatedAt');   
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    } 
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

router.put('/users/:id', checkAuth, checkRole('admin'), async (req: Request, res: Response): Promise<void> => {
    try {
        const updateSchema = z.object({
            email: z.string().email().optional(),
            role: z.enum(['user', 'assistant', 'admin']).optional(),
        });
        const validatedData = updateSchema.parse(req.body);
        const user = await User.findByIdAndUpdate(req.params.id, validatedData, { new: true }).select('-__v -createdAt -updatedAt');

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Invalidate cache for this user if their role changed
        if (validatedData.role) {
            invalidateUserCache(user.clerkId);
        }

        res.json(user);
    } 
    catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

router.delete('/users/:id', checkAuth, checkRole('admin'), async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Invalidate cache for deleted user
        invalidateUserCache(user.clerkId);

        res.status(204).send();
    } 
    catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;