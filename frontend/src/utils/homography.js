import { applyCanvasQuality } from './canvasQuality.js';
import { is2DLayoutMode, normalizeLayoutMode } from './layoutMode.js';
import { loadImage, waitForImage } from './imageLoader.js';
import { applyTemplateForegroundOverlay } from './foregroundOverlay.js';
import { apply2dEdgeShadows, apply2dHingeCrease, applyFinalJointCrease } from './mockup2d.js';
import {
  applySpineOffsetY,
  buildSpineCurveMesh,
  clipCurvedSpinePath,
  normalizeQuad,
  normalizeSpineBow,
  parseTemplateCoords,
  pointInCurvedSpine,
  SPINE_SEGMENTS,
} from './spineCurvature.js';
import {
  createCoverEdgeStrip,
  normalizeSpineMode,
  sampleCoverSpineColor,
  SPINE_MODES,
} from './spineSource.js';

const CANVAS_SIZE = 1024;

/** Luminance-only shading — soyalar, lekin shablon rangi (masalan ko‘k fon) o‘tmaydi */
const TEMPLATE_SHADING_INTENSITY = 0.32;

/**
 * Shablon yorug‘ligini qayta qo‘llash (faqat luminance, faqat muqova).
 * Korishokka qo‘llanmasa — shablon rangi (ko‘k fon) sizib chiqmaydi.
 */
const applyTemplateLuminanceShading = (
  targetCtx,
  lightingData,
  coverQuad,
  spineQuad = null,
  bows = {},
  intensity = TEMPLATE_SHADING_INTENSITY
) => {
  const mesh = spineQuad ? buildSpineCurveMesh(spineQuad, bows, SPINE_SEGMENTS) : null;
  const output = targetCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const outData = output.data;
  const bgData = lightingData.data;

  const shadePixel = (x, y) => {
    const index = (y * CANVAS_SIZE + x) * 4;
    if (outData[index + 3] < 8) return;

    const lum =
      (0.299 * bgData[index] + 0.587 * bgData[index + 1] + 0.114 * bgData[index + 2]) / 255;
    const blended = 1 + (lum - 0.5) * intensity;

    for (let ch = 0; ch < 3; ch += 1) {
      outData[index + ch] = Math.min(
        255,
        Math.max(0, Math.round(outData[index + ch] * blended))
      );
    }
  };

  const { minX, minY, maxX, maxY } = getBounds(coverQuad);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInQuad(x, y, coverQuad)) shadePixel(x, y);
    }
  }

  if (mesh) {
    const xs = [...mesh.topCurve, ...mesh.bottomCurve].map((p) => p.x);
    const ys = [...mesh.topCurve, ...mesh.bottomCurve].map((p) => p.y);
    const sMinX = Math.max(0, Math.floor(Math.min(...xs)) - 1);
    const sMinY = Math.max(0, Math.floor(Math.min(...ys)) - 1);
    const sMaxX = Math.min(CANVAS_SIZE - 1, Math.ceil(Math.max(...xs)) + 1);
    const sMaxY = Math.min(CANVAS_SIZE - 1, Math.ceil(Math.max(...ys)) + 1);

    for (let y = sMinY; y <= sMaxY; y += 1) {
      for (let x = sMinX; x <= sMaxX; x += 1) {
        if (pointInCurvedSpine(x, y, mesh.topCurve, mesh.bottomCurve)) shadePixel(x, y);
      }
    }
  }

  targetCtx.putImageData(output, 0, 0);
};

const multiplyMatrixVector = (matrix, vector) => {
  if (!Array.isArray(matrix) || !Array.isArray(vector)) return null;
  const result = new Array(matrix.length).fill(0);
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < vector.length; col += 1) {
      result[row] += matrix[row][col] * vector[col];
    }
  }
  return result;
};

const gaussianElimination = (augmented) => {
  if (!Array.isArray(augmented) || augmented.length === 0 || !Array.isArray(augmented[0])) {
    return null;
  }
  const n = augmented.length;
  const m = augmented[0].length;

  for (let pivot = 0; pivot < n; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row;
      }
    }

    if (Math.abs(augmented[maxRow][pivot]) < 1e-12) {
      return null;
    }

    if (maxRow !== pivot) {
      const temp = augmented[pivot];
      augmented[pivot] = augmented[maxRow];
      augmented[maxRow] = temp;
    }

    const pivotValue = augmented[pivot][pivot];
    for (let col = pivot; col < m; col += 1) {
      augmented[pivot][col] /= pivotValue;
    }

    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      if (factor === 0) continue;
      for (let col = pivot; col < m; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col];
      }
    }
  }

  return augmented.map((row) => row[n]);
};

export const computeHomography = (srcPoints, dstPoints) => {
  const rows = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = srcPoints[i];
    const { x: xp, y: yp } = dstPoints[i];

    rows.push([-x, -y, -1, 0, 0, 0, x * xp, y * xp, xp]);
    rows.push([0, 0, 0, -x, -y, -1, x * yp, y * yp, yp]);
  }

  const lhs = rows.map((row) => row.slice(0, 8));
  const rhs = rows.map((row) => -row[8]);
  const augmented = lhs.map((row, index) => [...row, rhs[index]]);
  const solution = gaussianElimination(augmented);

  if (!solution) {
    return null;
  }

  return [
    [solution[0], solution[1], solution[2]],
    [solution[3], solution[4], solution[5]],
    [solution[6], solution[7], 1],
  ];
};

export const invertHomography = (matrix) => {
  const [
    [a, b, c],
    [d, e, f],
    [g, h, i],
  ] = matrix;

  const det =
    a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  if (Math.abs(det) < 1e-12) {
    return null;
  }

  const invDet = 1 / det;

  return [
    [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
    [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
    [(d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet],
  ];
};

const applyHomography = (matrix, x, y) => {
  const vec = [x, y, 1];
  const mapped = multiplyMatrixVector(matrix, vec);
  if (!mapped) return null;
  const w = mapped[2];
  if (Math.abs(w) < 1e-12) {
    return null;
  }
  return { x: mapped[0] / w, y: mapped[1] / w };
};

const getBounds = (quad) => {
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxX = Math.min(CANVAS_SIZE - 1, Math.ceil(Math.max(...xs)));
  const maxY = Math.min(CANVAS_SIZE - 1, Math.ceil(Math.max(...ys)));
  return { minX, minY, maxX, maxY };
};

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

const sampleBilinear = (data, width, height, x, y) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const dx = x - x0;
  const dy = y - y0;

  const idx = (xx, yy) => (yy * width + xx) * 4;

  const c00 = idx(x0, y0);
  const c10 = idx(x1, y0);
  const c01 = idx(x0, y1);
  const c11 = idx(x1, y1);

  const rgba = [0, 0, 0, 0];
  for (let channel = 0; channel < 4; channel += 1) {
    const top = data[c00 + channel] * (1 - dx) + data[c10 + channel] * dx;
    const bottom = data[c01 + channel] * (1 - dx) + data[c11 + channel] * dx;
    rgba[channel] = top * (1 - dy) + bottom * dy;
  }
  return rgba;
};

const getSourcePixels = (image) => {
  const w = image.width || image.naturalWidth;
  const h = image.height || image.naturalHeight;
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  applyCanvasQuality(ctx);
  ctx.drawImage(image, 0, 0);
  return {
    width: w,
    height: h,
    data: ctx.getImageData(0, 0, w, h).data,
  };
};

const writeWarpPixel = (outData, outIndex, r, g, b, a) => {
  const alpha = a / 255;
  if (alpha <= 0) return;

  const dstA = outData[outIndex + 3] / 255;

  if (dstA < 0.04) {
    outData[outIndex] = r;
    outData[outIndex + 1] = g;
    outData[outIndex + 2] = b;
    outData[outIndex + 3] = Math.round(alpha * 255);
    return;
  }

  const outAlpha = alpha + dstA * (1 - alpha);
  if (outAlpha <= 0) return;

  outData[outIndex] = (r * alpha + outData[outIndex] * dstA * (1 - alpha)) / outAlpha;
  outData[outIndex + 1] = (g * alpha + outData[outIndex + 1] * dstA * (1 - alpha)) / outAlpha;
  outData[outIndex + 2] = (b * alpha + outData[outIndex + 2] * dstA * (1 - alpha)) / outAlpha;
  outData[outIndex + 3] = outAlpha * 255;
};

const warpImageToQuadData = (outData, image, quad) => {
  const normalized = normalizeQuad(quad);
  if (!image || !normalized) return;

  const srcW = image.width || image.naturalWidth;
  const srcH = image.height || image.naturalHeight;
  if (!srcW || !srcH) return;

  const srcQuad = [
    { x: 0, y: 0 },
    { x: srcW, y: 0 },
    { x: srcW, y: srcH },
    { x: 0, y: srcH },
  ];

  const forward = computeHomography(srcQuad, normalized);
  if (!forward) return;

  const inverse = invertHomography(forward);
  if (!inverse) return;

  const { width, height, data } = getSourcePixels(image);
  const { minX, minY, maxX, maxY } = getBounds(normalized);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!pointInQuad(x, y, normalized)) continue;

      const src = applyHomography(inverse, x, y);
      if (!src) continue;

      if (src.x < 0 || src.y < 0 || src.x >= width - 1 || src.y >= height - 1) {
        continue;
      }

      const [r, g, b, a] = sampleBilinear(data, width, height, src.x, src.y);
      writeWarpPixel(outData, (y * CANVAS_SIZE + x) * 4, r, g, b, a);
    }
  }
};

export const warpImageToQuad = (targetCtx, image, quad) => {
  const output = targetCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  warpImageToQuadData(output.data, image, quad);
  targetCtx.putImageData(output, 0, 0);
};

const hexToRgb = (hex) => {
  const raw = String(hex || '#2a2a2a').replace('#', '');
  if (raw.length !== 6) return { r: 42, g: 42, b: 42 };
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
};

/** Opaque spine base — blocks template background from showing through */
const fillOpaqueSpineRegion = (ctx, mesh, fillColor) => {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  clipCurvedSpinePath(ctx, mesh.topCurve, mesh.bottomCurve);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.restore();
};

/** Fill transparent warp gaps with solid edge color (not template bleed) */
const fillSpineLayerGaps = (layerCtx, mesh, gapFillColor) => {
  const { topCurve, bottomCurve } = mesh;
  const imageData = layerCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const data = imageData.data;
  const { r: fr, g: fg, b: fb } = hexToRgb(gapFillColor);

  const xs = [...topCurve, ...bottomCurve].map((p) => p.x);
  const ys = [...topCurve, ...bottomCurve].map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)) - 1);
  const minY = Math.max(0, Math.floor(Math.min(...ys)) - 1);
  const maxX = Math.min(CANVAS_SIZE - 1, Math.ceil(Math.max(...xs)) + 1);
  const maxY = Math.min(CANVAS_SIZE - 1, Math.ceil(Math.max(...ys)) + 1);

  for (let pass = 0; pass < 2; pass += 1) {
    const snapshot = new Uint8ClampedArray(data);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (!pointInCurvedSpine(x, y, topCurve, bottomCurve)) continue;

        const i = (y * CANVAS_SIZE + x) * 4;
        if (snapshot[i + 3] > 0) continue;

        if (gapFillColor) {
          data[i] = fr;
          data[i + 1] = fg;
          data[i + 2] = fb;
          data[i + 3] = 255;
          continue;
        }

        const neighbors = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];

        for (const [ox, oy] of neighbors) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= CANVAS_SIZE || ny >= CANVAS_SIZE) continue;
          const ni = (ny * CANVAS_SIZE + nx) * 4;
          if (snapshot[ni + 3] < 220) continue;
          data[i] = snapshot[ni];
          data[i + 1] = snapshot[ni + 1];
          data[i + 2] = snapshot[ni + 2];
          data[i + 3] = 255;
          break;
        }
      }
    }
  }

  layerCtx.putImageData(imageData, 0, 0);
};

/** Render spine mesh to isolated layer — opaque underpaint, then source-over strips */
const renderSpineMeshToLayer = (fullStripImage, spineQuad, bows, underpaintColor) => {
  const mesh = buildSpineCurveMesh(spineQuad, bows, SPINE_SEGMENTS);
  if (!mesh) return null;

  const srcW = fullStripImage.width || fullStripImage.naturalWidth;
  const srcH = fullStripImage.height || fullStripImage.naturalHeight;
  if (!srcW || !srcH) return null;

  const layer = document.createElement('canvas');
  layer.width = CANVAS_SIZE;
  layer.height = CANVAS_SIZE;
  const layerCtx = layer.getContext('2d', { willReadFrequently: true });
  layerCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  if (underpaintColor) {
    fillOpaqueSpineRegion(layerCtx, mesh, underpaintColor);
  }

  layerCtx.globalCompositeOperation = 'source-over';
  layerCtx.globalAlpha = 1;

  const layerData = layerCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const strips = mesh.strips;
  if (!Array.isArray(strips) || strips.length === 0) {
    fillSpineLayerGaps(layerCtx, mesh, underpaintColor);
    return { layer, layerCtx, mesh };
  }

  const segments = strips.length;
  const stripW = srcW / segments;

  for (let i = 0; i < segments; i += 1) {
    const { quad } = strips[i];
    const srcX0 = Math.max(0, Math.floor((i - 0.35) * stripW));
    const srcX1 = Math.min(srcW, Math.ceil((i + 1.35) * stripW));
    const sw = Math.max(1, srcX1 - srcX0);

    const stripCanvas = document.createElement('canvas');
    stripCanvas.width = sw;
    stripCanvas.height = srcH;
    const stripCtx = stripCanvas.getContext('2d');
    applyCanvasQuality(stripCtx);
    stripCtx.drawImage(fullStripImage, srcX0, 0, sw, srcH, 0, 0, sw, srcH);

    warpImageToQuadData(layerData.data, stripCanvas, quad);
  }

  layerCtx.putImageData(layerData, 0, 0);
  fillSpineLayerGaps(layerCtx, mesh, underpaintColor);

  return { layer, layerCtx, mesh };
};

const compositeSpineLayer = (targetCtx, layer) => {
  targetCtx.save();
  targetCtx.globalCompositeOperation = 'source-over';
  targetCtx.globalAlpha = 1;
  applyCanvasQuality(targetCtx);
  targetCtx.drawImage(layer, 0, 0);
  targetCtx.restore();
};

/**
 * Korishok — source-over only; solid edge color masks template background.
 */
const drawSpineOpaque = (targetCtx, spineQuad, bows, coverImage, spineMode) => {
  const mesh = buildSpineCurveMesh(spineQuad, bows, SPINE_SEGMENTS);
  if (!mesh) return;

  const fillColor = sampleCoverSpineColor(coverImage);
  const mode = normalizeSpineMode(spineMode);

  if (mode === SPINE_MODES.SOLID) {
    fillOpaqueSpineRegion(targetCtx, mesh, fillColor);
    return;
  }

  const [stl, str] = spineQuad;
  const spineScreenWidth = Math.hypot(str.x - stl.x, str.y - stl.y);
  const sliceFraction = Math.min(0.03, Math.max(0.018, 0.022));

  const spineStrip = createCoverEdgeStrip(coverImage, sliceFraction);
  const spineResult = renderSpineMeshToLayer(spineStrip, spineQuad, bows, fillColor);

  if (spineResult) {
    compositeSpineLayer(targetCtx, spineResult.layer);
  } else {
    fillOpaqueSpineRegion(targetCtx, mesh, fillColor);
  }
};

const renderMockup2D = async (ctx, { background, coverImage, cover, lightingSnapshot }) => {
  warpImageToQuad(ctx, coverImage, cover);
  apply2dHingeCrease(ctx, cover);
  apply2dEdgeShadows(ctx, cover);
  applyTemplateLuminanceShading(ctx, lightingSnapshot, cover, null, {}, 0.28);
};

const renderMockup3D = async (
  ctx,
  {
    coverImage,
    cover,
    spine,
    spineMode,
    bows,
    lightingSnapshot,
  }
) => {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  drawSpineOpaque(ctx, spine, bows, coverImage, spineMode);

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  warpImageToQuad(ctx, coverImage, cover);

  ctx.restore();

  applyTemplateLuminanceShading(ctx, lightingSnapshot, cover, null, bows);
};

export const renderMockup = async ({
  canvas,
  backgroundSrc,
  coverImage,
  coverCoords,
  spineCoords,
  spineBowTop = 0,
  spineBowBottom = 0,
  spineMode = SPINE_MODES.SOLID,
  spineOffsetY = 0,
  foregroundSrc = null,
  layoutMode = '3d',
}) => {
  const cover = parseTemplateCoords(coverCoords);
  const layout = normalizeLayoutMode(layoutMode);
  const is2D = is2DLayoutMode(layout);

  if (!cover) {
    throw new Error('Некорректные координаты обложки (нужно 4 точки).');
  }

  const spineBase = is2D ? null : parseTemplateCoords(spineCoords);
  const spine = spineBase ? applySpineOffsetY(spineBase, spineOffsetY) : null;
  if (!is2D && !spine) {
    throw new Error('Некорректные координаты шаблона (нужно 4 точки на обложку и корешок).');
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  applyCanvasQuality(ctx);
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const background = await loadImage(backgroundSrc);
  ctx.drawImage(background, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const lightingSnapshot = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  if (!coverImage) return;

  const bows = {
    topBow: normalizeSpineBow(spineBowTop),
    bottomBow: normalizeSpineBow(spineBowBottom),
  };

  if (is2D) {
    await renderMockup2D(ctx, { background, coverImage, cover, lightingSnapshot });
  } else {
    await renderMockup3D(ctx, {
      coverImage,
      cover,
      spine,
      spineMode,
      bows,
      lightingSnapshot,
    });
  }

  try {
    applyFinalJointCrease(ctx, {
      coverQuad: cover,
      spineQuad: spine,
      bows,
      is2D,
    });
  } catch (creaseError) {
    console.warn('Joint crease overlay skipped:', creaseError);
  }

  try {
    let foregroundImage = null;
    if (foregroundSrc) {
      foregroundImage = await loadImage(foregroundSrc);
    }

    applyTemplateForegroundOverlay(ctx, lightingSnapshot, {
      coverQuad: cover,
      spineQuad: spine,
      bows,
      is2D,
      foregroundImage,
    });
  } catch (foregroundError) {
    console.warn('Foreground overlay skipped:', foregroundError);
  }
};

export const CANVAS_DIMENSION = CANVAS_SIZE;
