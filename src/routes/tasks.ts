import { Hono } from 'hono';
import { checkAuth, checkRole, type AuthVariables } from '../middleware/auth';
import prisma, { isPrismaError, TaskPriority, TaskStatus } from '../lib/prisma';
import { taskMutex } from '../lib/queue';
import { z } from 'zod';

const app = new Hono<{ Variables: AuthVariables }>();

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['To Do', 'In Progress', 'Done']).optional(),
  dueDate: z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date format"
  }).optional(),
  assignee: z.string().optional(),
  assistantId: z.string().min(1, "Assistant is required"),
  tags: z.array(z.string()).optional()
});

const mapPriority = (value?: string | null): TaskPriority => {
  const mapping: Record<string, TaskPriority> = {
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH'
  };
  return value ? mapping[value] ?? 'MEDIUM' : 'MEDIUM';
};

const mapStatus = (value?: string | null): TaskStatus => {
  const mapping: Record<string, TaskStatus> = {
    'To Do': 'TO_DO',
    'In Progress': 'IN_PROGRESS',
    'Done': 'DONE'
  };
  return value ? mapping[value] ?? 'TO_DO' : 'TO_DO';
};

// Reverse mapping for frontend
const reverseMapPriority = (value: TaskPriority): string => {
  const mapping: Record<TaskPriority, string> = {
    'LOW': 'low',
    'MEDIUM': 'medium',
    'HIGH': 'high'
  };
  return mapping[value] ?? 'medium';
};

const reverseMapStatus = (value: TaskStatus): string => {
  const mapping: Record<TaskStatus, string> = {
    'TO_DO': 'To Do',
    'IN_PROGRESS': 'In Progress',
    'DONE': 'Done'
  };
  return mapping[value] ?? 'To Do';
};

// Transform Prisma task to frontend format
const transformTask = (task: any) => ({
  _id: task.id,
  title: task.title,
  description: task.description,
  priority: reverseMapPriority(task.priority),
  status: reverseMapStatus(task.status),
  dueDate: task.dueDate,
  assignee: task.assistant?.name ?? task.assignee,
  assistantId: task.assistantId,
  tags: task.tags,
  version: task.version,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt
});

app.get('/', checkAuth, checkRole('ASSISTANT'), async (c) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        assistant: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    return c.json(tasks.map(transformTask));
  } catch (error) {
    return c.json({ error: 'Failed to fetch tasks' }, 500);
  }
});

app.post('/', checkAuth, checkRole('ASSISTANT'), async (c) => {
  try {
    const body = await c.req.json();
    console.log('Creating task with data:', body);
    const validatedData = taskSchema.parse(body);

    const assistant = await prisma.assistant.findUnique({ where: { id: validatedData.assistantId } });
    if (!assistant) {
      return c.json({ error: 'Assistant not found' }, 400);
    }

    const task = await prisma.task.create({
      data: {
        title: validatedData.title,
        description: validatedData.description ?? '',
        priority: mapPriority(validatedData.priority),
        status: mapStatus(validatedData.status),
        assignee: assistant.name,
        tags: validatedData.tags ?? [],
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        assistant: {
          connect: { id: validatedData.assistantId }
        }
      },
      include: {
        assistant: {
          select: { id: true, name: true }
        }
      }
    });

    return c.json(transformTask(task), 201);
  } catch (error) {
    console.error('Create task error:', error);
    if (error instanceof z.ZodError) {
      return c.json({
        error: 'Invalid task data',
        details: error.issues
      }, 400);
    }
    return c.json({ error: 'Failed to create task' }, 500);
  }
});

app.put('/:id', checkAuth, checkRole('ASSISTANT'), async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    console.log('Updating task with ID:', id, 'Data:', body);
    
    const userVersion = body.version;
    if (userVersion === undefined || userVersion === null) {
      return c.json({ 
        error: 'Version is required for concurrency control',
        code: 'VERSION_REQUIRED'
      }, 400);
    }
    
    const validatedData = taskSchema.partial().parse(body);

    let updateData: any = {
      ...('title' in validatedData && validatedData.title !== undefined ? { title: validatedData.title } : {}),
      ...('description' in validatedData ? { description: validatedData.description ?? '' } : {}),
      ...('priority' in validatedData ? { priority: mapPriority(validatedData.priority) } : {}),
      ...('status' in validatedData ? { status: mapStatus(validatedData.status) } : {}),
      ...('assignee' in validatedData ? { assignee: validatedData.assignee ?? null } : {}),
      ...('tags' in validatedData ? { tags: validatedData.tags ?? [] } : {}),
      ...('dueDate' in validatedData ? { dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null } : {})
    };

    if (validatedData.assistantId) {
      const assistant = await prisma.assistant.findUnique({ where: { id: validatedData.assistantId } });
      if (!assistant) {
        return c.json({ error: 'Assistant not found' }, 400);
      }

      updateData = {
        ...updateData,
        assignee: assistant.name,
        assistant: {
          connect: { id: validatedData.assistantId }
        }
      };
    }

    const task = await taskMutex.run(id, async () => {
      const currentTask = await prisma.task.findUnique({
        where: { id },
        include: { assistant: { select: { id: true, name: true } } }
      });

      if (!currentTask) {
        throw new Error('TASK_NOT_FOUND');
      }

      if (currentTask.version > userVersion) {
        console.log(`[TaskQueue] Auto-merge for Task ${id}: user v${userVersion} -> db v${currentTask.version}`);
      }

      return prisma.task.update({
        where: { id },
        data: {
          ...updateData,
          version: { increment: 1 }
        },
        include: {
          assistant: { select: { id: true, name: true } }
        }
      });
    });

    return c.json(transformTask(task));
  } catch (error) {
    console.error('Update task error:', error);
    if (error instanceof z.ZodError) {
      return c.json({
        error: 'Invalid task data',
        details: error.issues
      }, 400);
    }
    if (error instanceof Error) {
      if (error.message === 'TASK_NOT_FOUND') {
        return c.json({ error: 'Task not found' }, 404);
      }
    }
    if (isPrismaError(error) && error.code === 'P2025') {
      return c.json({ error: 'Task not found' }, 404);
    }
    return c.json({ error: 'Failed to update task' }, 500);
  }
});

app.delete('/:id', checkAuth, checkRole('ASSISTANT'), async (c) => {
  try {
    const id = c.req.param('id');

    await prisma.task.delete({ where: { id } });
    return c.body(null, 204);
  } catch (error) {
    console.error('Delete task error:', error);
    if (isPrismaError(error) && error.code === 'P2025') {
      return c.json({ error: 'Task not found' }, 404);
    }
    return c.json({ error: 'Failed to delete task' }, 500);
  }
});

export default app;