import { Router, Request, Response } from 'express';
import { Task } from '../models';
import { AuthRequest, checkAuth, checkRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['To Do', 'In Progress', 'Done']).optional(),
  dueDate: z.string().datetime().optional(),
  assignee: z.string().optional(),
  tags: z.array(z.string()).optional()
});

router.get('/', checkAuth, checkRole('assistant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/', checkAuth, checkRole('assistant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = taskSchema.parse(req.body);
    const task = new Task(validatedData);
    await task.save();
    
    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid task data' });
      return;
    }
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/:id', checkAuth, checkRole('assistant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = taskSchema.partial().parse(req.body);
    const task = await Task.findByIdAndUpdate(req.params.id, validatedData, { new: true });
    
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid task data' });
      return;
    }
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/:id', checkAuth, checkRole('assistant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;