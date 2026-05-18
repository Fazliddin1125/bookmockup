/** Spine fill from the client-uploaded cover only — admin picks slice vs solid mode */

export const SPINE_MODES = {
  /** Narrow vertical strip from the left edge of the user's cover */
  SLICE: 'slice',
  /** Single flat color sampled from the user's cover */
  SOLID: 'solid',
};

export const normalizeSpineMode = (value) =>
  value === SPINE_MODES.SLICE ? SPINE_MODES.SLICE : SPINE_MODES.SOLID;

/**
 * Dominant color from the left edge of the client's cover (median, skips transparent edges).
 */
export const sampleCoverSpineColor = (coverImage) => {
  const w = coverImage.width || coverImage.naturalWidth;
  const h = coverImage.height || coverImage.naturalHeight;
  if (!w || !h) return '#2a2a2a';

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(coverImage, 0, 0);

  const cols = Math.max(3, Math.min(24, Math.floor(w * 0.035)));
  const y0 = Math.floor(h * 0.08);
  const y1 = Math.floor(h * 0.92);
  const data = ctx.getImageData(0, y0, cols, y1 - y0).data;
  const rowW = cols;

  const rs = [];
  const gs = [];
  const bs = [];

  for (let y = 0; y < y1 - y0; y += 2) {
    for (let x = 0; x < cols; x += 1) {
      const i = (y * rowW + x) * 4;
      if (data[i + 3] < 140) continue;
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
    }
  }

  if (rs.length === 0) return '#2a2a2a';

  const median = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  const hex = (v) => median(v).toString(16).padStart(2, '0');
  return `#${hex(rs)}${hex(gs)}${hex(bs)}`;
};

/**
 * Left-edge strip from the client's cover for slice mode.
 */
export const createCoverEdgeStrip = (coverImage, sliceFraction = 0.022) => {
  const coverH = coverImage.height || coverImage.naturalHeight || 1;
  const coverW = coverImage.width || coverImage.naturalWidth || 1;
  const sliceWidth = Math.max(2, Math.min(Math.floor(coverW * sliceFraction), 36));

  const strip = document.createElement('canvas');
  strip.width = sliceWidth;
  strip.height = coverH;
  const ctx = strip.getContext('2d');
  ctx.drawImage(coverImage, 0, 0, sliceWidth, coverH, 0, 0, sliceWidth, coverH);
  return strip;
};
