import { Hono } from 'hono';
import { checkAuth, checkRole, type AuthVariables } from '../middleware/auth';
import prisma, { isPrismaError, EventType, Prisma } from '../lib/prisma';
import { z } from 'zod';

const app = new Hono<{ Variables: AuthVariables }>();

const eventSchema = z.object({
  title: z.string().min(1),
  start: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format"
  }),
  end: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format"
  }).optional(),
  course: z.string().min(1),
  type: z.enum(['deadline', 'release', 'assessment', 'highlight']),
  description: z.string().optional(),
  photoUrl: z.string().optional(),
  linkAttachments: z.array(z.object({
    title: z.string(),
    url: z.string().url()
  })).optional()
});

const mapEventType = (type: string): EventType => {
  const mapping: Record<string, EventType> = {
    deadline: 'DEADLINE',
    release: 'RELEASE',
    assessment: 'ASSESSMENT',
    highlight: 'HIGHLIGHT'
  };

  return mapping[type] ?? 'HIGHLIGHT';
};

// Transform Prisma event to frontend format
const transformEvent = (event: any) => ({
  _id: event.id,
  title: event.title,
  start: event.start,
  end: event.end,
  course: event.course,
  type: event.type.toLowerCase(),
  description: event.description,
  photoUrl: event.photoUrl,
  linkAttachments: event.linkAttachments,
  version: event.version,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt
});

app.get('/', async (c) => {
  try {
    const course = c.req.query('course');

    const events = await prisma.event.findMany({
      where: course ? { course: String(course) } : {},
      orderBy: { start: 'asc' }
    });
    return c.json(events.map(transformEvent));
  } catch (error) {
    return c.json({ error: 'Failed to fetch events' }, 500);
  }
});

app.post('/', checkAuth, checkRole('ASSISTANT'), async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = eventSchema.parse(body);
    const event = await prisma.event.create({
      data: {
        title: validatedData.title,
        course: validatedData.course,
        type: mapEventType(validatedData.type),
        description: validatedData.description ?? null,
        photoUrl: validatedData.photoUrl ?? null,
        linkAttachments: validatedData.linkAttachments ?? Prisma.JsonNull,
        start: new Date(validatedData.start),
        end: validatedData.end ? new Date(validatedData.end) : null
      }
    });

    return c.json(transformEvent(event), 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid event data', details: error.issues }, 400);
    }
    return c.json({ error: 'Failed to create event' }, 500);
  }
});

app.put('/:id', checkAuth, checkRole('ASSISTANT'), async (c) => {
  try {
    const body = await c.req.json();
    const id = c.req.param('id');
    
    // OCC: Validate version is provided
    const currentVersion = body.version;
    if (currentVersion === undefined || currentVersion === null) {
      return c.json({ 
        error: 'Version is required for concurrency control',
        code: 'VERSION_REQUIRED'
      }, 400);
    }
    
    const validatedData = eventSchema.partial().parse(body);
    
    // OCC: Use transaction to ensure atomic check-and-update
    const event = await prisma.$transaction(async (tx) => {
      // First, check if the record exists with matching version
      const existing = await tx.event.findFirst({
        where: { id, version: currentVersion }
      });
      
      if (!existing) {
        // Check if record exists at all
        const eventExists = await tx.event.findUnique({ where: { id } });
        if (!eventExists) {
          throw new Error('EVENT_NOT_FOUND');
        }
        throw new Error('VERSION_CONFLICT');
      }
      
      // Update with version increment
      return tx.event.update({
        where: { id },
        data: {
          ...('title' in validatedData && validatedData.title !== undefined ? { title: validatedData.title } : {}),
          ...('course' in validatedData && validatedData.course !== undefined ? { course: validatedData.course } : {}),
          ...('type' in validatedData && validatedData.type !== undefined ? { type: mapEventType(validatedData.type) } : {}),
          ...('description' in validatedData ? { description: validatedData.description ?? null } : {}),
          ...('photoUrl' in validatedData ? { photoUrl: validatedData.photoUrl ?? null } : {}),
          ...('linkAttachments' in validatedData ? { linkAttachments: validatedData.linkAttachments ?? Prisma.JsonNull } : {}),
          ...('start' in validatedData && validatedData.start !== undefined ? { start: new Date(validatedData.start) } : {}),
          ...('end' in validatedData ? { end: validatedData.end ? new Date(validatedData.end) : null } : {}),
          version: { increment: 1 }
        }
      });
    });

    return c.json(transformEvent(event));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid event data', details: error.issues }, 400);
    }
    if (error instanceof Error) {
      if (error.message === 'EVENT_NOT_FOUND') {
        return c.json({ error: 'Event not found' }, 404);
      }
      if (error.message === 'VERSION_CONFLICT') {
        return c.json({ 
          error: 'Conflict: Data has been modified by another user. Please refresh and try again.',
          code: 'CONFLICT'
        }, 409);
      }
    }
    if (isPrismaError(error) && error.code === 'P2025') {
      return c.json({ error: 'Event not found' }, 404);
    }
    return c.json({ error: 'Failed to update event' }, 500);
  }
});

app.delete('/:id', checkAuth, checkRole('ASSISTANT'), async (c) => {
  try {
    const id = c.req.param('id');
    await prisma.event.delete({ where: { id } });
    return c.body(null, 204);
  } catch (error) {
    if (isPrismaError(error) && error.code === 'P2025') {
      return c.json({ error: 'Event not found' }, 404);
    }
    return c.json({ error: 'Failed to delete event' }, 500);
  }
});

export default app;