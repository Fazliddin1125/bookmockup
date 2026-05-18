import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Template from '../models/Template.js';
import { saveTemplateFile } from '../utils/fileStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookmockup';

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

  await mongoose.connect(MONGODB_URI);

  const buffer = fs.readFileSync(sourceAsset);
  const bgImage = await saveTemplateFile(buffer, 'cosmic-book-template.png', 'image/png');

  await Template.findOneAndUpdate(
    { title: cosmicSpaceHardcover.title },
    { ...cosmicSpaceHardcover, bgImage },
    { upsert: true, new: true }
  );

  console.log('Cosmic template GridFS ga saqlandi:', bgImage);
  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error('Cosmic seed failed:', error);
  process.exit(1);
});
