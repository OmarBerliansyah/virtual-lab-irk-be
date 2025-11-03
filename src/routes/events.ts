import { Router, Request, Response } from 'express';
import { Event } from '../models';
import { AuthRequest, checkAuth, checkRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const eventSchema = z.object({
  title: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime().optional(),
  course: z.string().min(1),
  type: z.enum(['deadline', 'release', 'assessment'])
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { course } = req.query;
    const filter = course ? { course } : {};
    
    const events = await Event.find(filter).sort({ start: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/', checkAuth, checkRole('assistant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = eventSchema.parse(req.body);
    const event = new Event(validatedData);
    await event.save();
    
    res.status(201).json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid event data', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/:id', checkAuth, checkRole('assistant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = eventSchema.partial().parse(req.body);
    const event = await Event.findByIdAndUpdate(req.params.id, validatedData, { new: true });
    
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    
    res.json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid event data', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/:id', checkAuth, checkRole('assistant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;