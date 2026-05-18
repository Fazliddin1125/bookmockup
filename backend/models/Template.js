import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  bgImage: { type: String, required: true },
  isPremium: { type: Boolean, default: false },
  coverCoords: {
    type: [pointSchema],
    required: true,
    validate: {
      validator: (coords) => Array.isArray(coords) && coords.length === 4,
      message: 'coverCoords must contain exactly 4 coordinate points',
    },
  },
  spineCoords: {
    type: [pointSchema],
    required: true,
    validate: {
      validator: (coords) => Array.isArray(coords) && coords.length === 4,
      message: 'spineCoords must contain exactly 4 coordinate points',
    },
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Template', templateSchema);
