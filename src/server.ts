import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { adminRoutes, eventRoutes, taskRoutes, webhookRoutes, userRoutes, assistantRoutes } from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT;

const options = {
  serverSelectionTimeoutMS: 60000
}

mongoose.connect(process.env.MONGO_URI!, options)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err: Error) => console.error('MongoDB connection error:', err));

app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://127.0.0.1:8080', 
    'http://192.168.1.1:8080',
    'https://virtual-lab-pewfk6707-omarberliansyahs-projects.vercel.app/',
    'https://virtual-lab-irk-fe.vercel.app',
    `${process.env.CORS_ORIGIN}`
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/events', eventRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assistants', assistantRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Virtual Lab IRK Backend API', 
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      health: '/health',
      home: '/api/home',
      events: '/api/events',
      tasks: '/api/tasks',
      webhooks: '/api/webhooks',
      admin: '/api/admin'
    }
  });
});

// For localhost only:
// app.listen(PORT, () => {
//   console.log(`Backend server running on http://localhost:${PORT}`);
// });

export default app;