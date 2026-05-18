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
      message: 'coverCoords должны содержать ровно 4 точки координат',
    },
  },
  spineCoords: {
    type: [pointSchema],
    required: true,
    validate: {
      validator: (coords) => Array.isArray(coords) && coords.length === 4,
      message: 'spineCoords должны содержать ровно 4 точки координат',
    },
  },
  spineCurvature: { type: Number, default: 0, min: 0, max: 120 },
  spineBowTop: { type: Number, default: 0, min: -240, max: 240 },
  spineBowBottom: { type: Number, default: 0, min: -240, max: 240 },
  /** Vertical shift of spine on canvas (px) */
  spineOffsetY: { type: Number, default: 0, min: -160, max: 160 },
  /** slice = narrow strip from cover left edge; solid = flat spineColor */
  spineMode: {
    type: String,
    enum: ['slice', 'solid'],
    default: 'solid',
  },
  spineColor: { type: String, default: '#334155', trim: true },
  /** solid mode: take color from user-uploaded cover edge instead of spineColor */
  spineColorAuto: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Template', templateSchema);
