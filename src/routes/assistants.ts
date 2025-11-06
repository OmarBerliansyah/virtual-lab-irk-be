import { Router } from 'express';
import { checkAuth, checkRole, AuthRequest } from '../middleware/auth';
import { Assistant, IAssistant } from '../models';
import { z } from 'zod';

const router = Router();

const createAssistantSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Invalid email format').regex(/^\d{8}@std\.stei\.itb\.ac\.id$/, 'Must be a valid ITB student email'),
  nim: z.string().regex(/^\d{8}$/, 'NIM must be 8 digits'),
  role: z.enum(['Assistant', 'Head Assistant', 'Research Assistant', 'Teaching Assistant', 'Lab Assistant']).optional(),
  image: z.string().refine((val) => {
    return val.startsWith('http') || val.startsWith('data:image/');
  }, 'Image must be a valid URL or base64 data URL').optional(),
  isActive: z.boolean().optional()
});

const updateAssistantSchema = z.object({
  name: z.string().min(1, 'Name is required').trim().optional(),
  role: z.enum(['Assistant', 'Head Assistant', 'Research Assistant', 'Teaching Assistant', 'Lab Assistant']).optional(),
  image: z.string().refine((val) => {
    return val.startsWith('http') || val.startsWith('data:image/');
  }, 'Image must be a valid URL or base64 data URL').optional(),
  isActive: z.boolean().optional()
});

router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    
    const filter: any = {};
    if (active === 'true') {
      filter.isActive = true;
    }
    
    const assistants = await Assistant.find(filter)
      .sort({ angkatan: 1, name: 1 })
      .select('-__v');

    res.json({
      success: true,
      data: assistants
    });
  } catch (error) {
    console.error('Error fetching assistants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assistants'
    });
  }
});

router.get('/me', checkAuth, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const userEmail = authReq.auth?.user?.email;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'User email not found'
      });
    }

    const assistant = await Assistant.findOne({ email: userEmail }).select('-__v');
    
    if (!assistant) {
      return res.status(404).json({
        success: false,
        error: 'Assistant profile not found'
      });
    }

    res.json({
      success: true,
      data: assistant
    });
  } catch (error) {
    console.error('Error fetching assistant profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assistant profile'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const assistant = await Assistant.findById(req.params.id).select('-__v');
    
    if (!assistant) {
      return res.status(404).json({
        success: false,
        error: 'Assistant not found'
      });
    }

    res.json({
      success: true,
      data: assistant
    });
  } catch (error) {
    console.error('Error fetching assistant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assistant'
    });
  }
});

// POST /assistants - Create new assistant (admin only)
router.post('/', checkAuth, checkRole('admin'), async (req, res) => {
  try {
    const validatedData = createAssistantSchema.parse(req.body);
    
    // Check if assistant with same email or NIM already exists
    const existingAssistant = await Assistant.findOne({
      $or: [
        { email: validatedData.email },
        { nim: validatedData.nim }
      ]
    });
    
    if (existingAssistant) {
      return res.status(400).json({
        success: false,
        error: 'Assistant with this email or NIM already exists'
      });
    }

    const assistant = await Assistant.create(validatedData);
    
    res.status(201).json({
      success: true,
      data: assistant,
      message: 'Assistant created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.issues
      });
    }
    
    console.error('Error creating assistant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create assistant'
    });
  }
});

// PUT /assistants/:id - Update assistant (assistant can update their own, admin can update any)
router.put('/:id', checkAuth, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const assistant = await Assistant.findById(req.params.id);
    
    if (!assistant) {
      return res.status(404).json({
        success: false,
        error: 'Assistant not found'
      });
    }

    // Check permissions: assistant can only update their own profile, admin can update any
    const isOwnProfile = assistant.email === authReq.auth?.user?.email;
    const isAdmin = authReq.auth?.user?.role === 'admin';
    
    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own profile'
      });
    }

    const validatedData = updateAssistantSchema.parse(req.body);
    
    // Only admins can change isActive status
    if (validatedData.isActive !== undefined && !isAdmin) {
      delete validatedData.isActive;
    }
    
    const updatedAssistant = await Assistant.findByIdAndUpdate(
      req.params.id,
      { ...validatedData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-__v');
    
    res.json({
      success: true,
      data: updatedAssistant,
      message: 'Assistant updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.issues
      });
    }
    
    console.error('Error updating assistant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update assistant'
    });
  }
});

// DELETE /assistants/:id - Delete assistant (admin only)
router.delete('/:id', checkAuth, checkRole('admin'), async (req, res) => {
  try {
    const assistant = await Assistant.findById(req.params.id);
    
    if (!assistant) {
      return res.status(404).json({
        success: false,
        error: 'Assistant not found'
      });
    }

    await Assistant.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Assistant deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assistant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete assistant'
    });
  }
});

// PATCH /assistants/:id/toggle-active - Toggle assistant active status (admin only)
router.patch('/:id/toggle-active', checkAuth, checkRole('admin'), async (req, res) => {
  try {
    const assistant = await Assistant.findById(req.params.id);
    
    if (!assistant) {
      return res.status(404).json({
        success: false,
        error: 'Assistant not found'
      });
    }

    assistant.isActive = !assistant.isActive;
    await assistant.save();
    
    res.json({
      success: true,
      data: assistant,
      message: `Assistant ${assistant.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling assistant status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle assistant status'
    });
  }
});

export { router as assistantRoutes };