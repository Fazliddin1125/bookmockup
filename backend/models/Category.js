import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

categorySchema.index({ parentId: 1, sortOrder: 1 });

export default mongoose.model('Category', categorySchema);
