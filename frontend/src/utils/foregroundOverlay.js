import { buildSpineCurveMesh, pointInCurvedSpine, SPINE_SEGMENTS } from './spineCurvature.js';

const CANVAS_SIZE = 1024;
const BOOK_BOUNDS_PAD = 28;

const pointInTriangle = (px, py, a, b, c) => {
  const sign = (p1, p2, p3) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);

  const d1 = sign({ x: px, y: py }, a, b);
  const d2 = sign({ x: px, y: py }, b, c);
  const d3 = sign({ x: px, y: py }, c, a);

  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
};

const pointInQuad = (px, py, quad) =>
  pointInTriangle(px, py, quad[0], quad[1], quad[2]) ||
  pointInTriangle(px, py, quad[0], quad[2], quad[3]);

const saturation = (r, g, b) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  if (max <= 0.001) return 0;
  return (max - min) / max;
};

const colorDist = (r, g, b, ref) =>
  Math.hypot(r - ref.r, g - ref.g, b - ref.b);

const isInBookRegion = (x, y, coverQuad, mesh) => {
  if (coverQuad && pointInQuad(x, y, coverQuad)) return true;
  if (mesh?.topCurve?.length && mesh?.bottomCurve?.length) {
    return pointInCurvedSpine(x, y, mesh.topCurve, mesh.bottomCurve);
  }
  return false;
};

const getExpandedBookBounds = (coverQuad, mesh, pad = BOOK_BOUNDS_PAD) => {
  const points = [...coverQuad];
  if (mesh?.topCurve?.length) points.push(...mesh.topCurve, ...mesh.bottomCurve);

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  return {
    minX: Math.max(0, Math.floor(Math.min(...xs)) - pad),
    minY: Math.max(0, Math.floor(Math.min(...ys)) - pad),
    maxX: Math.min(CANVAS_SIZE - 1, Math.ceil(Math.max(...xs)) + pad),
    maxY: Math.min(CANVAS_SIZE - 1, Math.ceil(Math.max(...ys)) + pad),
  };
};

/** Dominant flat book fill colors from the template (blue/white placeholder). */
const sampleBookPlaceholderColors = (templateData, coverQuad, mesh) => {
  const { minX, minY, maxX, maxY } = getExpandedBookBounds(coverQuad, mesh, 0);
  const samples = [];

  for (let y = minY; y <= maxY; y += 2) {
    for (let x = minX; x <= maxX; x += 2) {
      if (!isInBookRegion(x, y, coverQuad, mesh)) continue;

      const i = (y * CANVAS_SIZE + x) * 4;
      if (templateData[i + 3] < 40) continue;

      const r = templateData[i];
      const g = templateData[i + 1];
      const b = templateData[i + 2];
      samples.push({ r, g, b, sat: saturation(r, g, b) });
    }
  }

  if (samples.length < 6) {
    return [{ r: 28, g: 118, b: 255 }];
  }

  samples.sort((a, b) => a.sat - b.sat);
  const lowSat = samples.slice(0, Math.max(6, Math.floor(samples.length * 0.4)));

  const medianChannel = (channel) => {
    const sorted = lowSat.map((c) => c[channel]).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  return [
    {
      r: medianChannel('r'),
      g: medianChannel('g'),
      b: medianChannel('b'),
    },
  ];
};

const isNearPlaceholder = (r, g, b, placeholders, threshold) =>
  placeholders.some((ref) => colorDist(r, g, b, ref) < threshold);

const shouldRestoreForegroundPixel = (r, g, b, placeholders) => {
  if (isNearPlaceholder(r, g, b, placeholders, 38)) return false;

  const sat = saturation(r, g, b);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const minDist = Math.min(...placeholders.map((ref) => colorDist(r, g, b, ref)));

  if (sat > 0.13) return true;
  if (lum < 0.2 && minDist > 42) return true;
  return minDist > 58;
};

const decorOverlayAlpha = (r, g, b, placeholders) => {
  const sat = saturation(r, g, b);
  const minDist = Math.min(...placeholders.map((ref) => colorDist(r, g, b, ref)));
  const satBoost = Math.min(1, sat * 2.8);
  const distBoost = Math.min(1, minDist / 90);
  return Math.min(1, Math.max(0.72, satBoost * 0.55 + distBoost * 0.55));
};

const blendTemplatePixel = (out, i, r, g, b, alpha) => {
  const dstA = out[i + 3] / 255;
  const srcA = alpha;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0.001) return;

  out[i] = (r * srcA + out[i] * dstA * (1 - srcA)) / outA;
  out[i + 1] = (g * srcA + out[i + 1] * dstA * (1 - srcA)) / outA;
  out[i + 2] = (b * srcA + out[i + 2] * dstA * (1 - srcA)) / outA;
  out[i + 3] = outA * 255;
};

/**
 * Restore roses / props from the original template on top of the warped cover.
 * Stack: background → cover+spine → crease → foreground (this pass).
 */
export const applyTemplateForegroundOverlay = (
  ctx,
  templateSnapshot,
  { coverQuad, spineQuad, bows, is2D, foregroundImage = null }
) => {
  if (foregroundImage) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(foregroundImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.restore();
    return;
  }

  if (!templateSnapshot?.data || !coverQuad) return;

  const templateData = templateSnapshot.data;
  const mesh =
    !is2D && spineQuad ? buildSpineCurveMesh(spineQuad, bows, SPINE_SEGMENTS) : null;
  const placeholders = sampleBookPlaceholderColors(templateData, coverQuad, mesh);
  const { minX, minY, maxX, maxY } = getExpandedBookBounds(coverQuad, mesh, BOOK_BOUNDS_PAD);

  const output = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const out = output.data;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!isInBookRegion(x, y, coverQuad, mesh)) continue;

      const i = (y * CANVAS_SIZE + x) * 4;
      const r = templateData[i];
      const g = templateData[i + 1];
      const b = templateData[i + 2];

      if (!shouldRestoreForegroundPixel(r, g, b, placeholders)) continue;

      const alpha = decorOverlayAlpha(r, g, b, placeholders);
      blendTemplatePixel(out, i, r, g, b, alpha);
    }
  }

  ctx.putImageData(output, 0, 0);
};

export const FOREGROUND_CANVAS_SIZE = CANVAS_SIZE;
