import { Hono } from 'hono';
import { z } from 'zod';
import { checkAuth, checkRole, type AuthVariables } from '../middleware/auth';
import prisma, { AssistantRole, Prisma } from '../lib/prisma';

const app = new Hono<{ Variables: AuthVariables }>();

const createAssistantSchema = z.object({
  name: z.string().min(1).trim(),
  email: z.string().email().regex(/^\d{8}@std\.stei\.itb\.ac\.id$/),
  nim: z.string().regex(/^(135|182)\d{5}$/),
  role: z.enum(['ASSISTANT', 'HEAD_ASSISTANT', 'RESEARCH_ASSISTANT', 'TEACHING_ASSISTANT', 'LAB_ASSISTANT']).optional(),
  image: z
    .string()
    .refine((val) => val.startsWith('http') || val.startsWith('data:image/'))
    .optional(),
  isActive: z.boolean().optional()
});

const updateAssistantSchema = z.object({
  name: z.string().min(1).trim().optional(),
  email: z.string().email().regex(/^\d{8}@std\.stei\.itb\.ac\.id$/).optional(),
  nim: z.string().regex(/^(135|182)\d{5}$/).optional(),
  role: z.enum(['ASSISTANT', 'HEAD_ASSISTANT', 'RESEARCH_ASSISTANT', 'TEACHING_ASSISTANT', 'LAB_ASSISTANT']).optional(),
  image: z
    .union([
      z.string().refine((val) => val.startsWith('http') || val.startsWith('data:image/')),
      z.literal(null)
    ])
    .optional(),
  isActive: z.boolean().optional()
});

const mapAssistantRole = (role?: string | null): AssistantRole => {
  if (!role) return 'ASSISTANT';

  // If the value is already a valid enum, keep it
  if (Object.values(AssistantRole).includes(role as AssistantRole)) {
    return role as AssistantRole;
  }

  // Support legacy human-readable labels
  const mapping: Record<string, AssistantRole> = {
    'Assistant': 'ASSISTANT',
    'Head Assistant': 'HEAD_ASSISTANT',
    'Research Assistant': 'RESEARCH_ASSISTANT',
    'Teaching Assistant': 'TEACHING_ASSISTANT',
    'Lab Assistant': 'LAB_ASSISTANT'
  };

  return mapping[role] ?? 'ASSISTANT';
};

const transformAssistant = (assistant: any) => ({
  _id: assistant.id,
  name: assistant.name,
  email: assistant.email,
  nim: assistant.nim,
  angkatan: assistant.angkatan,
  role: assistant.role,
  image: assistant.image,
  isActive: assistant.isActive,
  createdAt: assistant.createdAt,
  updatedAt: assistant.updatedAt
});

const formatZodIssues = (issues: z.ZodIssue[]) =>
  issues.map((issue) => `${issue.path.join('.') || 'field'}: ${issue.message}`).join('; ');

app.get('/', async (c) => {
  try {
    const active = c.req.query('active');
    const filter: Prisma.AssistantWhereInput = {};
    if (active === 'true') {
      filter.isActive = true;
    }

    const assistants = await prisma.assistant.findMany({
      where: filter,
      orderBy: [{ angkatan: 'asc' }, { name: 'asc' }]
    });

    return c.json({ success: true, data: assistants.map(transformAssistant) });
  } catch (error) {
    console.error('Error fetching assistants:', error);
    return c.json({ success: false, error: 'Failed to fetch assistants' }, 500);
  }
});

app.get('/me', checkAuth, async (c) => {
  try {
    const userEmail = c.get('auth')?.user?.email;
    if (!userEmail) {
      return c.json({ success: false, error: 'User email not found' }, 400);
    }

    const assistant = await prisma.assistant.findUnique({ where: { email: userEmail } });
    if (!assistant) {
      return c.json({ success: false, error: 'Assistant profile not found' }, 404);
    }

    return c.json({ success: true, data: transformAssistant(assistant) });
  } catch (error) {
    console.error('Error fetching assistant profile:', error);
    return c.json({ success: false, error: 'Failed to fetch assistant profile' }, 500);
  }
});

app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) return c.json({ success: false, error: 'Assistant ID is required' }, 400);

    const assistant = await prisma.assistant.findUnique({ where: { id } });
    if (!assistant) {
      return c.json({ success: false, error: 'Assistant not found' }, 404);
    }

    return c.json({ success: true, data: transformAssistant(assistant) });
  } catch (error) {
    console.error('Error fetching assistant:', error);
    return c.json({ success: false, error: 'Failed to fetch assistant' }, 500);
  }
});

app.post('/', checkAuth, checkRole('ADMIN'), async (c) => {
  try {
    const validatedData = createAssistantSchema.parse(await c.req.json());

    const existingAssistant = await prisma.assistant.findFirst({
      where: { OR: [{ email: validatedData.email }, { nim: validatedData.nim }] }
    });

    if (existingAssistant) {
      return c.json({ success: false, error: 'Assistant with this email or NIM already exists' }, 400);
    }

    const angkatanFromNim = validatedData.nim.substring(3, 5);
    const assistant = await prisma.assistant.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        nim: validatedData.nim,
        angkatan: `IF'${angkatanFromNim}`,
        role: mapAssistantRole(validatedData.role),
        image: validatedData.image ?? null,
        isActive: validatedData.isActive ?? true
      }
    });

    return c.json({ success: true, data: transformAssistant(assistant), message: 'Assistant created successfully' }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: error.issues,
        message: formatZodIssues(error.issues)
      }, 400);
    }
    console.error('Error creating assistant:', error);
    return c.json({ success: false, error: 'Failed to create assistant' }, 500);
  }
});

app.put('/:id', checkAuth, async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) return c.json({ success: false, error: 'Assistant ID is required' }, 400);

    const assistant = await prisma.assistant.findUnique({ where: { id } });
    if (!assistant) {
      return c.json({ success: false, error: 'Assistant not found' }, 404);
    }

    const auth = c.get('auth');
    const isOwnProfile = assistant.email === auth?.user?.email;
    const isAdmin = auth?.user?.role === 'ADMIN';
    const isAssistant = auth?.user?.role === 'ASSISTANT';
    if (!isOwnProfile && !isAdmin && !isAssistant) {
      return c.json({ success: false, error: 'You can only update your own profile' }, 403);
    }

    const validatedData = updateAssistantSchema.parse(await c.req.json());
    if (validatedData.isActive !== undefined && !isAdmin) {
      delete validatedData.isActive;
    }

    const updateData: { name?: string; role?: AssistantRole; image?: string | null; isActive?: boolean; email?: string; nim?: string; angkatan?: string } = {};
    if ('name' in validatedData && validatedData.name !== undefined) updateData.name = validatedData.name;
    if ('role' in validatedData && validatedData.role !== undefined) updateData.role = mapAssistantRole(validatedData.role);
    if ('image' in validatedData) updateData.image = validatedData.image ?? null;
    if ('isActive' in validatedData && validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (isAdmin) {
      if ('email' in validatedData && validatedData.email !== undefined) updateData.email = validatedData.email;
      if ('nim' in validatedData && validatedData.nim !== undefined) {
        updateData.nim = validatedData.nim;
        const angkatanFromNim = validatedData.nim.substring(3, 5);
        updateData.angkatan = `IF'${angkatanFromNim}`;
      }
    }

    const updatedAssistant = await prisma.assistant.update({ where: { id }, data: updateData });

    return c.json({ success: true, data: transformAssistant(updatedAssistant), message: 'Assistant updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: error.issues,
        message: formatZodIssues(error.issues)
      }, 400);
    }
    console.error('Error updating assistant:', error);
    return c.json({ success: false, error: 'Failed to update assistant' }, 500);
  }
});

app.delete('/:id', checkAuth, checkRole('ADMIN'), async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) return c.json({ success: false, error: 'Assistant ID is required' }, 400);

    const assistant = await prisma.assistant.findUnique({ where: { id } });
    if (!assistant) {
      return c.json({ success: false, error: 'Assistant not found' }, 404);
    }

    await prisma.assistant.delete({ where: { id } });
    return c.json({ success: true, message: 'Assistant deleted successfully' });
  } catch (error) {
    console.error('Error deleting assistant:', error);
    return c.json({ success: false, error: 'Failed to delete assistant' }, 500);
  }
});

app.patch('/:id/toggle-active', checkAuth, checkRole('ADMIN'), async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) return c.json({ success: false, error: 'Assistant ID is required' }, 400);

    const assistant = await prisma.assistant.findUnique({ where: { id } });
    if (!assistant) {
      return c.json({ success: false, error: 'Assistant not found' }, 404);
    }

    const updatedAssistant = await prisma.assistant.update({
      where: { id },
      data: { isActive: !assistant.isActive }
    });

    return c.json({
      success: true,
      data: transformAssistant(updatedAssistant),
      message: `Assistant ${updatedAssistant.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling assistant status:', error);
    return c.json({ success: false, error: 'Failed to toggle assistant status' }, 500);
  }
});

export { app as assistantRoutes };