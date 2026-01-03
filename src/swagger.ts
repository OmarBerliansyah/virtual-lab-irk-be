import swaggerJSDoc from 'swagger-jsdoc';

const serverUrl = process.env.API_BASE_URL || 'http://localhost:8000';

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Virtual Lab IRK Backend API',
    version: '1.0.0',
    description:
      'Comprehensive OpenAPI documentation for the Virtual Lab IRK backend. All endpoints are served from a single Express instance and secured with Clerk bearer tokens unless noted otherwise.',
  },
  servers: [
    {
      url: serverUrl,
      description: 'Current server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Health: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'OK' },
          message: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'number' },
          environment: { type: 'string' },
          database: { type: 'string', example: 'connected' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'array', items: { type: 'string' }, nullable: true },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65a1b2c3d4e5f67890123456' },
          clerkId: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['USER', 'ASSISTANT', 'ADMIN'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Assistant: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email', example: '13522001@std.stei.itb.ac.id' },
          nim: { type: 'string', example: '13522001' },
          angkatan: { type: 'string', example: "IF'22" },
          role: {
            type: 'string',
            enum: ['ASSISTANT', 'Head Assistant', 'Research Assistant', 'Teaching Assistant', 'Lab Assistant'],
          },
          image: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          start: { type: 'string', format: 'date-time' },
          end: { type: 'string', format: 'date-time', nullable: true },
          course: { type: 'string' },
          type: { type: 'string', enum: ['deadline', 'release', 'assessment', 'highlight'] },
          description: { type: 'string', nullable: true },
          photoUrl: { type: 'string', nullable: true },
          linkAttachments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                url: { type: 'string', format: 'uri' },
              },
            },
            nullable: true,
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          status: { type: 'string', enum: ['To Do', 'In Progress', 'Done'] },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          assignee: { type: 'string', nullable: true },
          tags: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Health', description: 'Health and root endpoints' },
    { name: 'Events', description: 'Event calendar endpoints (assistant only for write)' },
    { name: 'Tasks', description: 'Task management endpoints (assistant only)' },
    { name: 'Users', description: 'Authenticated user profile' },
    { name: 'Assistants', description: 'Assistant directory and profile management' },
    { name: 'ADMIN', description: 'Admin-only user management' },
    { name: 'Webhooks', description: 'Inbound webhooks (no auth token required)' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: {
          200: {
            description: 'Health info',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Health' },
              },
            },
          },
        },
      },
    },
    '/': {
      get: {
        tags: ['Health'],
        summary: 'Root metadata',
        security: [],
        responses: {
          200: {
            description: 'API metadata',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    version: { type: 'string' },
                    status: { type: 'string' },
                    endpoints: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/events': {
      get: {
        tags: ['Events'],
        summary: 'List events',
        parameters: [
          {
            name: 'course',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by course code',
          },
        ],
        responses: {
          200: {
            description: 'Events list',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Event' } } } },
          },
        },
      },
      post: {
        tags: ['Events'],
        summary: 'Create event (assistant only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'start', 'course', 'type'],
                properties: {
                  title: { type: 'string' },
                  start: { type: 'string', format: 'date-time' },
                  end: { type: 'string', format: 'date-time' },
                  course: { type: 'string' },
                  type: { type: 'string', enum: ['deadline', 'release', 'assessment', 'highlight'] },
                  description: { type: 'string' },
                  photoUrl: { type: 'string' },
                  linkAttachments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['title', 'url'],
                      properties: {
                        title: { type: 'string' },
                        url: { type: 'string', format: 'uri' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/events/{id}': {
      put: {
        tags: ['Events'],
        summary: 'Update event (assistant only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  start: { type: 'string', format: 'date-time' },
                  end: { type: 'string', format: 'date-time' },
                  course: { type: 'string' },
                  type: { type: 'string', enum: ['deadline', 'release', 'assessment', 'highlight'] },
                  description: { type: 'string' },
                  photoUrl: { type: 'string' },
                  linkAttachments: { $ref: '#/components/schemas/Event/properties/linkAttachments' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Not found' },
        },
      },
      delete: {
        tags: ['Events'],
        summary: 'Delete event (assistant only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          204: { description: 'Deleted' },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/tasks': {
      get: {
        tags: ['Tasks'],
        summary: 'List tasks (assistant only)',
        responses: {
          200: { description: 'Tasks list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Task' } } } } },
        },
      },
      post: {
        tags: ['Tasks'],
        summary: 'Create task (assistant only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                  status: { type: 'string', enum: ['To Do', 'In Progress', 'Done'] },
                  dueDate: { type: 'string', format: 'date-time' },
                  assignee: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          400: { description: 'Validation error' },
        },
      },
    },
    '/api/tasks/{id}': {
      put: {
        tags: ['Tasks'],
        summary: 'Update task (assistant only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                  status: { type: 'string', enum: ['To Do', 'In Progress', 'Done'] },
                  dueDate: { type: 'string', format: 'date-time' },
                  assignee: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          404: { description: 'Not found' },
        },
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Delete task (assistant only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          204: { description: 'Deleted' },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/users/profile': {
      get: {
        tags: ['Users'],
        summary: 'Get authenticated user profile',
        responses: {
          200: { description: 'Profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          401: { description: 'Unauthorized' },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Update authenticated user email',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/assistants': {
      get: {
        tags: ['Assistants'],
        summary: 'List assistants',
        parameters: [
          {
            name: 'active',
            in: 'query',
            schema: { type: 'string', enum: ['true', 'false'] },
            description: 'Filter by active status',
          },
        ],
        responses: {
          200: {
            description: 'Assistant list',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Assistant' } } } } } },
          },
        },
      },
      post: {
        tags: ['Assistants'],
        summary: 'Create assistant (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'nim'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  nim: { type: 'string' },
                  role: { type: 'string' },
                  image: { type: 'string' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created assistant', content: { 'application/json': { schema: { $ref: '#/components/schemas/Assistant' } } } },
          400: { description: 'Validation error' },
        },
      },
    },
    '/api/assistants/me': {
      get: {
        tags: ['Assistants'],
        summary: 'Get own assistant profile',
        responses: {
          200: { description: 'Profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/Assistant' } } } },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/assistants/{id}': {
      get: {
        tags: ['Assistants'],
        summary: 'Get assistant by id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'ASSISTANT', content: { 'application/json': { schema: { $ref: '#/components/schemas/Assistant' } } } },
          404: { description: 'Not found' },
        },
      },
      put: {
        tags: ['Assistants'],
        summary: 'Update assistant (self or admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  role: { type: 'string' },
                  image: { type: 'string' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated assistant', content: { 'application/json': { schema: { $ref: '#/components/schemas/Assistant' } } } },
          403: { description: 'Forbidden' },
          404: { description: 'Not found' },
        },
      },
      delete: {
        tags: ['Assistants'],
        summary: 'Delete assistant (admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } } } } } },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/assistants/{id}/toggle-active': {
      patch: {
        tags: ['Assistants'],
        summary: 'Toggle assistant active status (admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Toggled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Assistant' } } } },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/admin/users': {
      get: {
        tags: ['ADMIN'],
        summary: 'List users (admin only)',
        responses: {
          200: { description: 'User list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } },
        },
      },
    },
    '/api/admin/update/{id}/role': {
      put: {
        tags: ['ADMIN'],
        summary: 'Update user role by id (admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['USER', 'ASSISTANT', 'ADMIN'] } } } } },
        },
        responses: {
          200: { description: 'Updated user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/admin/create/{id}/role': {
      post: {
        tags: ['ADMIN'],
        summary: 'Set user role by id (admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['USER', 'ASSISTANT', 'ADMIN'] } } } } },
        },
        responses: {
          200: { description: 'Updated user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/admin/users/{id}': {
      get: {
        tags: ['ADMIN'],
        summary: 'Get user by id (admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'USER', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          404: { description: 'Not found' },
        },
      },
      put: {
        tags: ['ADMIN'],
        summary: 'Update user (admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['USER', 'ASSISTANT', 'ADMIN'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          404: { description: 'Not found' },
        },
      },
      delete: {
        tags: ['ADMIN'],
        summary: 'Delete user (admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          204: { description: 'Deleted' },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/webhooks/clerk': {
      post: {
        tags: ['Webhooks'],
        summary: 'Clerk webhook endpoint',
        security: [],
        requestBody: {
          description: 'Raw Clerk webhook payload',
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true },
            },
          },
        },
        responses: {
          200: { description: 'Accepted' },
          400: { description: 'Verification failure' },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: [],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
