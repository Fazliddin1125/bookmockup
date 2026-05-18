import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import templateRoutes from './routes/templateRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { UPLOADS_DIR } from './middleware/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 5001;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookmockup';

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads/templates', express.static(UPLOADS_DIR));
app.use('/api/auth', authRoutes);
app.use('/api/templates', templateRoutes);

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Book Mockup API is running',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.listen(PORT, () => {
  console.log(`Book Mockup API listening on http://localhost:${PORT}`);
  console.log(`Uploads folder: ${UPLOADS_DIR}`);
  console.log(`Auth login: POST http://localhost:${PORT}/api/auth/login`);
  console.log(`Templates: GET/POST /api/templates | PUT/DELETE /api/templates/:id`);

  mongoose
    .connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    })
    .then(() => console.log('MongoDB connected'))
    .catch((error) => {
      console.error('MongoDB ulanmadi:', error.message);
    });
});
