import { loadImage, waitForImage } from './imageLoader.js';

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
  const offscreen = document.createElement('canvas');
  offscreen.width = image.width;
  offscreen.height = image.height;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    data: ctx.getImageData(0, 0, image.width, image.height).data,
  };
};

export const warpImageToQuad = (targetCtx, image, quad) => {
  if (!image || !image.width || !image.height) {
    return;
  }

  const srcQuad = [
    { x: 0, y: 0 },
    { x: image.width, y: 0 },
    { x: image.width, y: image.height },
    { x: 0, y: image.height },
  ];

  const forward = computeHomography(srcQuad, quad);
  if (!forward) return;

  const inverse = invertHomography(forward);
  if (!inverse) return;

  const { width, height, data } = getSourcePixels(image);
  const output = targetCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const outData = output.data;

  const { minX, minY, maxX, maxY } = getBounds(quad);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!pointInQuad(x, y, quad)) continue;

      const src = applyHomography(inverse, x, y);
      if (!src) continue;

      if (src.x < 0 || src.y < 0 || src.x >= width - 1 || src.y >= height - 1) {
        continue;
      }

      const [r, g, b, a] = sampleBilinear(data, width, height, src.x, src.y);
      const outIndex = (y * CANVAS_SIZE + x) * 4;
      const alpha = a / 255;

      if (alpha <= 0) continue;

      const dstIndex = outIndex;

      if (alpha > 0.92) {
        outData[dstIndex] = r;
        outData[dstIndex + 1] = g;
        outData[dstIndex + 2] = b;
        outData[dstIndex + 3] = 255;
        continue;
      }

      const dstA = outData[dstIndex + 3] / 255;
      const outAlpha = alpha + dstA * (1 - alpha);

      if (outAlpha <= 0) continue;

      outData[dstIndex] = (r * alpha + outData[dstIndex] * dstA * (1 - alpha)) / outAlpha;
      outData[dstIndex + 1] =
        (g * alpha + outData[dstIndex + 1] * dstA * (1 - alpha)) / outAlpha;
      outData[dstIndex + 2] =
        (b * alpha + outData[dstIndex + 2] * dstA * (1 - alpha)) / outAlpha;
      outData[dstIndex + 3] = outAlpha * 255;
    }
  }

  targetCtx.putImageData(output, 0, 0);
};

export const drawSpineShadowOverlay = (targetCtx, spineQuad) => {
  const [tl, tr, br, bl] = spineQuad;

  const hingeX = (tl.x + bl.x) / 2;
  const hingeY = (tl.y + bl.y) / 2;
  const outerX = (tr.x + br.x) / 2;
  const outerY = (tr.y + br.y) / 2;

  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = CANVAS_SIZE;
  overlayCanvas.height = CANVAS_SIZE;
  const overlayCtx = overlayCanvas.getContext('2d');

  overlayCtx.save();
  overlayCtx.beginPath();
  overlayCtx.moveTo(tl.x, tl.y);
  overlayCtx.lineTo(tr.x, tr.y);
  overlayCtx.lineTo(br.x, br.y);
  overlayCtx.lineTo(bl.x, bl.y);
  overlayCtx.closePath();
  overlayCtx.clip();

  const gradient = overlayCtx.createLinearGradient(hingeX, hingeY, outerX, outerY);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
  gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.18)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  overlayCtx.fillStyle = gradient;
  overlayCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  overlayCtx.restore();

  const creaseGradient = overlayCtx.createLinearGradient(
    tl.x,
    tl.y,
    tr.x,
    tr.y
  );
  overlayCtx.save();
  overlayCtx.beginPath();
  overlayCtx.moveTo(tl.x, tl.y);
  overlayCtx.lineTo(tr.x, tr.y);
  overlayCtx.lineTo(br.x, br.y);
  overlayCtx.lineTo(bl.x, bl.y);
  overlayCtx.closePath();
  overlayCtx.clip();
  creaseGradient.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
  creaseGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  overlayCtx.fillStyle = creaseGradient;
  overlayCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  overlayCtx.restore();

  targetCtx.drawImage(overlayCanvas, 0, 0);
};

const applySurfaceLighting = (targetCtx, lightingData, quad, intensity = 0.72) => {
  const output = targetCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const outData = output.data;
  const bgData = lightingData.data;
  const { minX, minY, maxX, maxY } = getBounds(quad);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!pointInQuad(x, y, quad)) continue;

      const index = (y * CANVAS_SIZE + x) * 4;
      if (outData[index + 3] < 8) continue;

      const bgR = bgData[index];
      const bgG = bgData[index + 1];
      const bgB = bgData[index + 2];
      const luminance = (0.299 * bgR + 0.587 * bgG + 0.114 * bgB) / 255;
      const blended = 1 - intensity + intensity * luminance;

      for (let channel = 0; channel < 3; channel += 1) {
        outData[index + channel] = Math.min(
          255,
          Math.max(0, Math.round(outData[index + channel] * blended))
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
}) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const background = await loadImage(backgroundSrc);
  ctx.drawImage(background, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const lightingSnapshot = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  if (coverImage) {
    const sliceWidth = Math.max(1, Math.floor(coverImage.width * 0.04));
    const spineSliceCanvas = document.createElement('canvas');
    spineSliceCanvas.width = sliceWidth;
    spineSliceCanvas.height = coverImage.height;
    const spineSliceCtx = spineSliceCanvas.getContext('2d');
    spineSliceCtx.drawImage(
      coverImage,
      0,
      0,
      sliceWidth,
      coverImage.height,
      0,
      0,
      sliceWidth,
      coverImage.height
    );

    const spineSliceImage = new Image();
    spineSliceImage.crossOrigin = 'anonymous';
    spineSliceImage.src = spineSliceCanvas.toDataURL('image/png');
    await waitForImage(spineSliceImage);

    warpImageToQuad(ctx, spineSliceImage, spineCoords);
    applySurfaceLighting(ctx, lightingSnapshot, spineCoords, 0.5);

    warpImageToQuad(ctx, coverImage, coverCoords);
    applySurfaceLighting(ctx, lightingSnapshot, coverCoords, 0.42);

    drawSpineShadowOverlay(ctx, spineCoords);
  }
};

export const CANVAS_DIMENSION = CANVAS_SIZE;
