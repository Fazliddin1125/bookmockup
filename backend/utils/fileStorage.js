import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET_NAME = 'templateImages';

export const UPLOADS_DIR =
  process.env.UPLOADS_PATH || path.join(__dirname, '../uploads/templates');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const getBucket = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB не подключена — невозможно сохранить файл');
  }
  return new GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
};

const toFilename = (relativePath) => {
  if (!relativePath) return null;
  return path.basename(relativePath.replace('/uploads/templates/', ''));
};

export const saveTemplateFile = async (buffer, originalName, mimetype) => {
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const filename = `${randomUUID()}${ext}`;
  const relativePath = `/uploads/templates/${filename}`;

  const bucket = getBucket();

  await new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimetype || 'image/jpeg',
      metadata: { originalName },
    });
    uploadStream.on('error', reject);
    uploadStream.on('finish', resolve);
    uploadStream.end(buffer);
  });

  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

  return relativePath;
};

export const deleteTemplateFile = async (relativePath) => {
  const filename = toFilename(relativePath);
  if (!filename) return;

  const diskPath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(diskPath)) {
    fs.unlinkSync(diskPath);
  }

  if (mongoose.connection.readyState !== 1) return;

  try {
    const bucket = getBucket();
    const files = await bucket.find({ filename }).toArray();
    await Promise.all(files.map((file) => bucket.delete(file._id)));
  } catch (error) {
    console.warn('GridFS delete:', filename, error.message);
  }
};

export const streamTemplateFile = async (filename, res) => {
  const safeName = path.basename(filename);

  if (mongoose.connection.readyState === 1) {
    const bucket = getBucket();
    const files = await bucket.find({ filename: safeName }).toArray();

    if (files.length > 0) {
      res.set('Content-Type', files[0].contentType || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      const stream = bucket.openDownloadStreamByName(safeName);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.status(404).json({ success: false, message: 'Изображение не найдено' });
        }
      });
      stream.pipe(res);
      return;
    }
  }

  const diskPath = path.join(UPLOADS_DIR, safeName);
  if (fs.existsSync(diskPath)) {
    res.sendFile(diskPath);
    return;
  }

  res.status(404).json({ success: false, message: 'Изображение не найдено' });
};
