import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Template from '../models/Template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookmockup';

const uploadsDir = path.join(__dirname, '../uploads/templates');
const sourceAsset = path.join(__dirname, '../assets/cosmic-book-template.png');

const cosmicSpaceHardcover = {
  title: 'Cosmic Space Hardcover',
  isPremium: false,
  coverCoords: [
    { x: 188, y: 318 },
    { x: 578, y: 212 },
    { x: 872, y: 662 },
    { x: 408, y: 852 },
  ],
  spineCoords: [
    { x: 108, y: 342 },
    { x: 188, y: 318 },
    { x: 408, y: 852 },
    { x: 92, y: 872 },
  ],
};

const seed = async () => {
  if (!fs.existsSync(sourceAsset)) {
    console.error('cosmic-book-template.png topilmadi:', sourceAsset);
    process.exit(1);
  }

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filename = 'cosmic-space-hardcover.png';
  const destPath = path.join(uploadsDir, filename);
  fs.copyFileSync(sourceAsset, destPath);

  await mongoose.connect(MONGODB_URI);

  const existing = await Template.findOne({ title: cosmicSpaceHardcover.title });
  if (existing?.bgImage?.startsWith('/uploads/')) {
    const oldPath = path.join(__dirname, '..', existing.bgImage);
    if (fs.existsSync(oldPath) && !oldPath.endsWith(filename)) {
      fs.unlinkSync(oldPath);
    }
  }

  await Template.findOneAndUpdate(
    { title: cosmicSpaceHardcover.title },
    {
      ...cosmicSpaceHardcover,
      bgImage: `/uploads/templates/${filename}`,
    },
    { upsert: true, new: true }
  );

  console.log('Cosmic template (fayl + MongoDB) tayyor.');
  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error('Cosmic seed failed:', error);
  process.exit(1);
});
