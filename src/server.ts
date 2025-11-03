import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { eventRoutes, taskRoutes, webhookRoutes } from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT;

mongoose.connect(process.env.MONGO_URI!)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err: Error) => console.error('MongoDB connection error:', err));

app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://127.0.0.1:8080', 
    'http://192.168.1.1:8080',
    process.env.CORS_ORIGIN || 'http://localhost:8080'
  ],
  credentials: true
}));
app.use(express.json());

app.use('/api/events', eventRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/webhooks', webhookRoutes);

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
      webhooks: '/api/webhooks'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});