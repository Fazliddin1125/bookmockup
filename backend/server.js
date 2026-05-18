import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import templateRoutes from './routes/templateRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { streamTemplateFile } from './utils/fileStorage.js';

const app = express();
const PORT = Number(process.env.PORT) || 5001;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookmockup';

const defaultOrigins = [
  'https://bookmockup-seven.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
];

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : defaultOrigins;

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

app.get('/uploads/templates/:filename', async (req, res) => {
  try {
    await streamTemplateFile(req.params.filename, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/templates', templateRoutes);

app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API генератора 3D макетов книг',
    health: '/api/health',
    templates: '/api/templates',
  });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API генератора 3D макетов книг работает',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    storage: 'GridFS + disk cache',
  });
});

const start = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB ulanmadi:', error.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Book Mockup API listening on http://localhost:${PORT}`);
    console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
    console.log('Rasmlar: MongoDB GridFS (/uploads/templates/:filename)');
  });
};

start();
