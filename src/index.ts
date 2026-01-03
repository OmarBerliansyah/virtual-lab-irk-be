import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { swaggerUI } from '@hono/swagger-ui';
import prisma from './lib/prisma';
import swaggerSpec from './swagger';

// Import Routes
import eventRoutes from './routes/events';
import taskRoutes from './routes/tasks';
import webhookRoutes from './routes/webhooks';
import adminRoutes from './routes/admin';
import userRoutes from './routes/users';
import { assistantRoutes } from './routes/assistants';

const app = new Hono();
const PORT = Number(process.env.PORT) || 8000;

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());

// CORS
app.use('*', cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:5173',
    'https://virtual-lab-irk-fe.vercel.app',
    ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : [])
  ],
  credentials: true,
}));

// DB Connection check
prisma.$connect()
  .then(() => console.log('Prisma connected successfully'))
  .catch((err: Error) => console.error('Prisma connection error:', err));

// Root route
app.get('/', (c) => c.json({
  message: 'Virtual Lab IRK Backend API',
  version: '1.0.0',
  status: 'Running'
}));

// Health check
app.get('/health', async (c) => {
  let database = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'connected';
  } catch (e) {
    console.error(e);
  }

  return c.json({
    status: 'OK',
    uptime: process.uptime(),
    database
  });
});

// Mount sub-apps
app.route('/api/events', eventRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api/webhooks', webhookRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/users', userRoutes);
app.route('/api/assistants', assistantRoutes);

// Swagger Documentation
app.get('/docs', swaggerUI({ url: '/docs.json' }));
app.get('/docs.json', (c) => c.json(swaggerSpec));

console.log(`Server is running on port ${PORT}`);

export default app;
