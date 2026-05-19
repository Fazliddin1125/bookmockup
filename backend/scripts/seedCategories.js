import 'dotenv/config';
import mongoose from 'mongoose';
import Category from '../models/Category.js';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookmockup';

const defaults = [
  { name: 'Бесплатные макеты', slug: 'free', sortOrder: 0 },
  { name: 'Премиум макеты', slug: 'premium', sortOrder: 1 },
  { name: 'Космос и фэнтези', slug: 'cosmic-fantasy', sortOrder: 2 },
  { name: 'Деловые издания', slug: 'business', sortOrder: 3 },
];

const seed = async () => {
  await mongoose.connect(MONGODB_URI);

  for (const item of defaults) {
    await Category.findOneAndUpdate(
      { slug: item.slug },
      { ...item, isActive: true, parentId: null },
      { upsert: true, new: true }
    );
  }

  const count = await Category.countDocuments();
  console.log(`Categories ready: ${count}`);
  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
