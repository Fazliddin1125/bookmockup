import { loadImage, waitForImage } from './imageLoader.js';
import {
  applySpineOffsetY,
  buildSpineCurveMesh,
  clipCurvedSpinePath,
  normalizeQuad,
  normalizeSpineBow,
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

const multiplyMatrixVector = (matrix, vector) => {
  const result = new Array(matrix.length).fill(0);
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < vector.length; col += 1) {
      result[row] += matrix[row][col] * vector[col];
    }
  }
  return result;
};

const gaussianElimination = (augmented) => {
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

/** Fill only fully empty pixels inside curved spine (avoids gray strip banding) */
const fillSpineLayerGaps = (layerCtx, mesh) => {
  const { topCurve, bottomCurve } = mesh;
  const imageData = layerCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const data = imageData.data;

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

/** Render spine mesh to isolated layer — no background bleed between strips */
const renderSpineMeshToLayer = (fullStripImage, spineQuad, bows) => {
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

  const layerData = layerCtx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
  const { strips } = mesh;
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
    stripCtx.drawImage(fullStripImage, srcX0, 0, sw, srcH, 0, 0, sw, srcH);

    warpImageToQuadData(layerData.data, stripCanvas, quad);
  }

  layerCtx.putImageData(layerData, 0, 0);
  fillSpineLayerGaps(layerCtx, mesh);

  return { layer, layerCtx, mesh };
};

/** Solid spine — single fill, no strip mesh (no background bleed) */
const renderSolidSpine = (targetCtx, spineQuad, bows, fillColor) => {
  const mesh = buildSpineCurveMesh(spineQuad, bows, SPINE_SEGMENTS);
  if (!mesh) return;

  targetCtx.save();
  clipCurvedSpinePath(targetCtx, mesh.topCurve, mesh.bottomCurve);
  targetCtx.fillStyle = fillColor;
  targetCtx.fill();
  targetCtx.restore();
};

const applySurfaceLighting = (targetCtx, lightingData, quad, intensity = 0.2) => {
  const normalized = normalizeQuad(quad);
  if (!normalized) return;

  const output = targetCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const outData = output.data;
  const bgData = lightingData.data;
  const { minX, minY, maxX, maxY } = getBounds(normalized);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!pointInQuad(x, y, normalized)) continue;

      const index = (y * CANVAS_SIZE + x) * 4;
      if (outData[index + 3] < 8) continue;

      const lum =
        (0.299 * bgData[index] + 0.587 * bgData[index + 1] + 0.114 * bgData[index + 2]) / 255;
      const blended = 1 + (lum - 0.5) * intensity;

      for (let ch = 0; ch < 3; ch += 1) {
        outData[index + ch] = Math.min(
          255,
          Math.max(0, Math.round(outData[index + ch] * blended))
        );
      }
    }
  }

  targetCtx.putImageData(output, 0, 0);
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
}) => {
  const cover = normalizeQuad(coverCoords);
  const spine = normalizeQuad(applySpineOffsetY(spineCoords, spineOffsetY));

  if (!cover || !spine) {
    throw new Error('Некорректные координаты шаблона (нужно 4 точки на обложку и корешок).');
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const background = await loadImage(backgroundSrc);
  ctx.drawImage(background, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const lightingSnapshot = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  if (!coverImage) return;

  const mode = normalizeSpineMode(spineMode);
  const bows = {
    topBow: normalizeSpineBow(spineBowTop),
    bottomBow: normalizeSpineBow(spineBowBottom),
  };
  const hasBow = bows.topBow !== 0 || bows.bottomBow !== 0;

  if (mode === SPINE_MODES.SOLID) {
    const fillColor = sampleCoverSpineColor(coverImage);
    renderSolidSpine(ctx, spine, bows, fillColor);
  } else {
    const [stl, str] = spine;
    const spineScreenWidth = Math.hypot(str.x - stl.x, str.y - stl.y);
    const coverScreenWidth = Math.hypot(cover[1].x - cover[0].x, cover[1].y - cover[0].y);
    const widthRatio = coverScreenWidth > 1 ? spineScreenWidth / coverScreenWidth : 0.08;
    const sliceFraction = Math.min(0.03, Math.max(0.018, widthRatio * 0.3));

    const spineStrip = createCoverEdgeStrip(coverImage, sliceFraction);

    if (hasBow) {
      const spineResult = renderSpineMeshToLayer(spineStrip, spine, bows);
      if (spineResult) {
        ctx.drawImage(spineResult.layer, 0, 0);
      }
    } else {
      warpImageToQuad(ctx, spineStrip, spine);
    }
  }

  warpImageToQuad(ctx, coverImage, cover);
  applySurfaceLighting(ctx, lightingSnapshot, cover, 0.12);
};

export const CANVAS_DIMENSION = CANVAS_SIZE;
