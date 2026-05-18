import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Template from '../models/Template.js';
import { saveTemplateFile } from '../utils/fileStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGODB_URI = process.env.MONGODB_URI;

const migrate = async () => {
  await mongoose.connect(MONGODB_URI);
  const templates = await Template.find();
  let migrated = 0;

  for (const template of templates) {
    if (!template.bgImage?.startsWith('/uploads/templates/')) continue;

    const filename = path.basename(template.bgImage);
    const diskPath = path.join(__dirname, '../uploads/templates', filename);

    if (!fs.existsSync(diskPath)) {
      console.log('Skip (disk missing):', template.title, filename);
      continue;
    }

    const buffer = fs.readFileSync(diskPath);
    const newPath = await saveTemplateFile(buffer, filename, 'image/jpeg');
    template.bgImage = newPath;
    await template.save();
    migrated += 1;
    console.log('Migrated:', template.title);
  }

  console.log(`Done. Migrated ${migrated} templates.`);
  await mongoose.disconnect();
};

migrate().catch(console.error);
