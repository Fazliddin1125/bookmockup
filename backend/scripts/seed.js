import 'dotenv/config';
import mongoose from 'mongoose';
import Template from '../models/Template.js';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookmockup';

const createBackgroundDataUrl = () => {
  const canvas = { width: 1024, height: 1024 };

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 1024 1024">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1a1f2e"/>
          <stop offset="100%" stop-color="#0d1018"/>
        </linearGradient>
        <linearGradient id="desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2d3348"/>
          <stop offset="100%" stop-color="#171b28"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="18" flood-color="#000" flood-opacity="0.45"/>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="url(#bg)"/>
      <ellipse cx="512" cy="900" rx="360" ry="60" fill="#000" opacity="0.35"/>
      <rect x="0" y="700" width="1024" height="324" fill="url(#desk)"/>
      <g filter="url(#shadow)">
        <path d="M330 250 L700 290 L680 780 L310 740 Z" fill="#3a3f52" opacity="0.95"/>
        <path d="M290 270 L330 250 L310 740 L270 720 Z" fill="#2a2f40" opacity="0.95"/>
        <path d="M700 290 L740 310 L720 800 L680 780 Z" fill="#222735" opacity="0.8"/>
      </g>
      <path d="M330 250 L700 290 L680 780 L310 740 Z" fill="none" stroke="#ffffff" stroke-opacity="0.06"/>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const templates = [
  {
    title: 'Studio Desk — Free',
    isPremium: false,
    bgImage: createBackgroundDataUrl(),
    coverCoords: [
      { x: 420, y: 180 },
      { x: 860, y: 220 },
      { x: 820, y: 820 },
      { x: 380, y: 780 },
    ],
    spineCoords: [
      { x: 360, y: 200 },
      { x: 420, y: 180 },
      { x: 380, y: 780 },
      { x: 340, y: 760 },
    ],
    spineMode: 'solid',
    spineColor: '#2a2f40',
  },
  {
    title: 'Editorial Gold — Premium',
    isPremium: true,
    bgImage: createBackgroundDataUrl(),
    coverCoords: [
      { x: 450, y: 210 },
      { x: 880, y: 250 },
      { x: 840, y: 790 },
      { x: 410, y: 750 },
    ],
    spineCoords: [
      { x: 390, y: 230 },
      { x: 450, y: 210 },
      { x: 410, y: 750 },
      { x: 370, y: 730 },
    ],
    spineMode: 'solid',
    spineColor: '#222735',
  },
];

const seed = async () => {
  await mongoose.connect(MONGODB_URI);
  await Template.deleteMany({});
  await Template.insertMany(templates);
  console.log(`Seeded ${templates.length} templates.`);
  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
