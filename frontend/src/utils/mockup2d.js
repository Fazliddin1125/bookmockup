import { buildSpineCurveMesh, normalizeQuad } from './spineCurvature.js';

/** Binding crease inset from left edge (4–5% of cover width) */
export const HINGE_INSET_FRACTION = 0.045;

/** Localized multiply crease — px each side of joint line */
export const JOINT_CREASE_HALF_WIDTH = 5;
export const JOINT_CREASE_CENTER_ALPHA = 0.55;
export const JOINT_HIGHLIGHT_ALPHA = 0.4;
export const JOINT_HIGHLIGHT_OFFSET_PX = 1;
const LIGHT_COVER_LUM_THRESHOLD = 0.62;
const CANVAS_BOUNDS = 1024;

const lerpPoint = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const getCoverQuad = (coverCoords) => normalizeQuad(coverCoords);

/** Vertical crease segment (top → bottom) at ~4.5% cover width */
export const getHingeCreaseSegment = (coverQuad) => {
  const quad = getCoverQuad(coverQuad);
  if (!quad) return null;
  const [tl, tr, br, bl] = quad;
  return {
    top: lerpPoint(tl, tr, HINGE_INSET_FRACTION),
    bottom: lerpPoint(bl, br, HINGE_INSET_FRACTION),
  };
};

const clipCoverQuad = (ctx, quad) => {
  const [tl, tr, br, bl] = quad;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.clip();
};

const coverInwardNormal = (quad) => {
  const [tl, tr, br, bl] = quad;
  const midLeft = lerpPoint(tl, bl, 0.5);
  const midRight = lerpPoint(tr, br, 0.5);
  const nx = midRight.x - midLeft.x;
  const ny = midRight.y - midLeft.y;
  const len = Math.hypot(nx, ny) || 1;
  return { x: nx / len, y: ny / len };
};

const quadCenter = (quad) => {
  const [a, b, c, d] = quad;
  return {
    x: (a.x + b.x + c.x + d.x) / 4,
    y: (a.y + b.y + c.y + d.y) / 4,
  };
};

const orientNormalToward = (nx, ny, from, toward) => {
  const dot = (toward.x - from.x) * nx + (toward.y - from.y) * ny;
  if (dot < 0) return { x: -nx, y: -ny };
  return { x: nx, y: ny };
};

const getJointFrame = (jointTop, jointBottom, towardPoint) => {
  const dx = jointBottom.x - jointTop.x;
  const dy = jointBottom.y - jointTop.y;
  const jointLen = Math.hypot(dx, dy) || 1;

  let nx = -(dy / jointLen);
  let ny = dx / jointLen;

  const mid = {
    x: (jointTop.x + jointBottom.x) / 2,
    y: (jointTop.y + jointBottom.y) / 2,
  };

  if (towardPoint) {
    ({ x: nx, y: ny } = orientNormalToward(nx, ny, mid, towardPoint));
  }

  return { nx, ny, mid };
};

/** Sample cover brightness beside the joint (for light-cover boost). */
export const sampleJointCoverLuminance = (ctx, jointTop, jointBottom, towardPoint) => {
  try {
    const { nx, ny } = getJointFrame(jointTop, jointBottom, towardPoint);
    const samples = 12;
    let sum = 0;
    let count = 0;

    for (let i = 0; i < samples; i += 1) {
      const t = samples === 1 ? 0.5 : i / (samples - 1);
      const px = jointTop.x + t * (jointBottom.x - jointTop.x);
      const py = jointTop.y + t * (jointBottom.y - jointTop.y);
      const sx = Math.round(px + nx * 16);
      const sy = Math.round(py + ny * 16);

      if (sx < 0 || sy < 0 || sx >= CANVAS_BOUNDS || sy >= CANVAS_BOUNDS) continue;

      const d = ctx.getImageData(sx, sy, 1, 1).data;
      if (!d || d[3] < 12) continue;

      sum += (0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]) / 255;
      count += 1;
    }

    return count ? sum / count : 0.5;
  } catch {
    return 0.5;
  }
};

/** Brighter covers get a stronger multiply crease so white textures still show a fold. */
export const resolveDynamicCreaseAlpha = (avgLum, baseAlpha = JOINT_CREASE_CENTER_ALPHA) => {
  if (avgLum <= LIGHT_COVER_LUM_THRESHOLD) return baseAlpha;
  const boost = Math.min(0.38, (avgLum - LIGHT_COVER_LUM_THRESHOLD) * 1.4);
  return Math.min(0.92, baseAlpha + boost);
};

/**
 * Multiply crease + 1px specular highlight (cover side of joint).
 * Drawn last in the render pile so it bakes into bright/white covers.
 */
export const applyJointCreaseShadow = (
  ctx,
  jointTop,
  jointBottom,
  {
    halfWidth = JOINT_CREASE_HALF_WIDTH,
    centerAlpha = JOINT_CREASE_CENTER_ALPHA,
    towardPoint = null,
    highlightAlpha = JOINT_HIGHLIGHT_ALPHA,
    extraMultiplyOnLight = false,
  } = {}
) => {
  if (!jointTop || !jointBottom) return;

  const { nx, ny } = getJointFrame(jointTop, jointBottom, towardPoint);
  const band = JOINT_CREASE_HALF_WIDTH;
  const mid = {
    x: (jointTop.x + jointBottom.x) / 2,
    y: (jointTop.y + jointBottom.y) / 2,
  };

  const gx0 = mid.x - nx * band;
  const gy0 = mid.y - ny * band;
  const gx1 = mid.x + nx * band;
  const gy1 = mid.y + ny * band;

  const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.5, `rgba(0, 0, 0, ${centerAlpha})`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(jointTop.x - nx * band, jointTop.y - ny * band);
  ctx.lineTo(jointTop.x + nx * band, jointTop.y + ny * band);
  ctx.lineTo(jointBottom.x + nx * band, jointBottom.y + ny * band);
  ctx.lineTo(jointBottom.x - nx * band, jointBottom.y - ny * band);
  ctx.closePath();
  ctx.fill();

  if (extraMultiplyOnLight) {
    const tight = Math.max(2, band * 0.45);
    const tightGrad = ctx.createLinearGradient(
      mid.x - nx * tight,
      mid.y - ny * tight,
      mid.x + nx * tight,
      mid.y + ny * tight
    );
    tightGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    tightGrad.addColorStop(0.5, `rgba(0, 0, 0, ${Math.min(0.5, centerAlpha * 0.55)})`);
    tightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = tightGrad;
    ctx.beginPath();
    ctx.moveTo(jointTop.x - nx * tight, jointTop.y - ny * tight);
    ctx.lineTo(jointTop.x + nx * tight, jointTop.y + ny * tight);
    ctx.lineTo(jointBottom.x + nx * tight, jointBottom.y + ny * tight);
    ctx.lineTo(jointBottom.x - nx * tight, jointBottom.y - ny * tight);
    ctx.closePath();
    ctx.fill();
  }

  const hi = JOINT_HIGHLIGHT_OFFSET_PX;
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = `rgba(255, 255, 255, ${highlightAlpha})`;
  ctx.lineWidth = 1;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(jointTop.x + nx * hi, jointTop.y + ny * hi);
  ctx.lineTo(jointBottom.x + nx * hi, jointBottom.y + ny * hi);
  ctx.stroke();

  ctx.restore();
};

/** Final overlay — call after all shading so crease reads on light covers. */
export const applyFinalJointCrease = (ctx, { coverQuad, spineQuad, bows, is2D }) => {
  const cover = getCoverQuad(coverQuad);
  if (!cover) return;

  const towardPoint = quadCenter(cover);
  const segment = is2D
    ? getHingeCreaseSegment(cover)
    : getCoverSpineJointSegment(spineQuad, bows);

  if (!segment) return;

  const avgLum = sampleJointCoverLuminance(ctx, segment.top, segment.bottom, towardPoint);
  const centerAlpha = resolveDynamicCreaseAlpha(avgLum);

  applyJointCreaseShadow(ctx, segment.top, segment.bottom, {
    halfWidth: JOINT_CREASE_HALF_WIDTH,
    centerAlpha,
    towardPoint,
    highlightAlpha: JOINT_HIGHLIGHT_ALPHA,
    extraMultiplyOnLight: avgLum > 0.72,
  });
};

/** 3D: curved hinge line where cover meets spine (STR↔SBR edge). */
export const getCoverSpineJointSegment = (spineQuad, bows = {}) => {
  const mesh = buildSpineCurveMesh(spineQuad, bows);
  if (!mesh?.topCurve?.length || !mesh?.bottomCurve?.length) return null;
  const n = mesh.topCurve.length - 1;
  return {
    top: mesh.topCurve[n],
    bottom: mesh.bottomCurve[n],
  };
};

/**
 * Deep physical fold at the hinge — multiply gradients (no template color bleed).
 */
export const apply2dHingeCrease = (ctx, coverQuad) => {
  const quad = getCoverQuad(coverQuad);
  if (!quad) return;

  const [tl, tr, br, bl] = quad;
  const topCrease = lerpPoint(tl, tr, HINGE_INSET_FRACTION);
  const botCrease = lerpPoint(bl, br, HINGE_INSET_FRACTION);
  const coverWidth = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const hingeBand = Math.max(12, coverWidth * 0.065);
  const inward = coverInwardNormal(quad);

  const creaseMid = lerpPoint(topCrease, botCrease, 0.5);

  ctx.save();
  clipCoverQuad(ctx, quad);

  const prevOp = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'multiply';

  // 1) Left 0%–5% hinge radius — base darkening
  const leftGrad = ctx.createLinearGradient(tl.x, tl.y, topCrease.x, topCrease.y);
  leftGrad.addColorStop(0, '#5c5c5c');
  leftGrad.addColorStop(0.45, '#2a2a2a');
  leftGrad.addColorStop(1, '#ffffff');

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = leftGrad;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(topCrease.x, topCrease.y);
  ctx.lineTo(botCrease.x, botCrease.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.fill();

  // 2) Deep crease band — perpendicular multiply gradient centered on fold line
  const gx0 = creaseMid.x - inward.x * hingeBand;
  const gy0 = creaseMid.y - inward.y * hingeBand;
  const gx1 = creaseMid.x + inward.x * hingeBand * 0.4;
  const gy1 = creaseMid.y + inward.y * hingeBand * 0.4;

  const creaseGrad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
  creaseGrad.addColorStop(0, '#6e6e6e');
  creaseGrad.addColorStop(0.28, '#2b2b2b');
  creaseGrad.addColorStop(0.48, '#0a0a0a');
  creaseGrad.addColorStop(0.52, '#121212');
  creaseGrad.addColorStop(0.72, '#3d3d3d');
  creaseGrad.addColorStop(1, '#ffffff');

  ctx.globalAlpha = 1;
  ctx.fillStyle = creaseGrad;

  const bandOuter = {
    x: creaseMid.x - inward.x * hingeBand * 1.1,
    y: creaseMid.y - inward.y * hingeBand * 1.1,
  };
  const bandInner = {
    x: creaseMid.x + inward.x * hingeBand * 0.55,
    y: creaseMid.y + inward.y * hingeBand * 0.55,
  };
  const topOuter = {
    x: topCrease.x - inward.x * hingeBand * 0.85,
    y: topCrease.y - inward.y * hingeBand * 0.85,
  };
  const topInner = {
    x: topCrease.x + inward.x * hingeBand * 0.45,
    y: topCrease.y + inward.y * hingeBand * 0.45,
  };
  const botOuter = {
    x: botCrease.x - inward.x * hingeBand * 0.85,
    y: botCrease.y - inward.y * hingeBand * 0.85,
  };
  const botInner = {
    x: botCrease.x + inward.x * hingeBand * 0.45,
    y: botCrease.y + inward.y * hingeBand * 0.45,
  };

  ctx.beginPath();
  ctx.moveTo(topOuter.x, topOuter.y);
  ctx.lineTo(topInner.x, topInner.y);
  ctx.lineTo(botInner.x, botInner.y);
  ctx.lineTo(botOuter.x, botOuter.y);
  ctx.closePath();
  ctx.fill();

  // 3) Sharp crease spine line
  const lineGrad = ctx.createLinearGradient(
    topCrease.x - inward.x * hingeBand * 0.15,
    topCrease.y - inward.y * hingeBand * 0.15,
    topCrease.x + inward.x * hingeBand * 0.12,
    topCrease.y + inward.y * hingeBand * 0.12
  );
  lineGrad.addColorStop(0, '#3a3a3a');
  lineGrad.addColorStop(0.5, '#050505');
  lineGrad.addColorStop(1, '#8a8a8a');

  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = Math.max(3.5, coverWidth * 0.006);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(topCrease.x, topCrease.y);
  ctx.lineTo(botCrease.x, botCrease.y);
  ctx.stroke();

  ctx.globalCompositeOperation = prevOp || 'source-over';
  ctx.globalAlpha = prevAlpha;
  ctx.restore();
};

const edgeInset = (quad, edge, fraction) => {
  const [tl, tr, br, bl] = quad;
  if (edge === 'left') {
    const iTop = lerpPoint(tl, tr, fraction);
    const iBot = lerpPoint(bl, br, fraction);
    return { outer0: tl, outer1: bl, inner0: iTop, inner1: iBot };
  }
  if (edge === 'right') {
    const iTop = lerpPoint(tr, tl, fraction);
    const iBot = lerpPoint(br, bl, fraction);
    return { outer0: tr, outer1: br, inner0: iTop, inner1: iBot };
  }
  const iLeft = lerpPoint(bl, tl, fraction);
  const iRight = lerpPoint(br, tr, fraction);
  return { outer0: bl, outer1: br, inner0: iLeft, inner1: iRight };
};

const fillMultiplyBand = (ctx, band, strength = 0.72) => {
  const { outer0, outer1, inner0, inner1 } = band;
  const grad = ctx.createLinearGradient(outer0.x, outer0.y, inner0.x, inner0.y);
  grad.addColorStop(0, `rgba(55, 55, 55, ${strength})`);
  grad.addColorStop(1, 'rgba(255, 255, 255, 1)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(outer0.x, outer0.y);
  ctx.lineTo(inner0.x, inner0.y);
  ctx.lineTo(inner1.x, inner1.y);
  ctx.lineTo(outer1.x, outer1.y);
  ctx.closePath();
  ctx.fill();
};

/** Premium edge depth — procedural multiply shadows (no template color bleed) */
export const apply2dEdgeShadows = (ctx, coverQuad) => {
  const quad = getCoverQuad(coverQuad);
  if (!quad) return;

  const edgeFraction = 0.085;

  ctx.save();
  clipCoverQuad(ctx, quad);

  const prevOp = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.92;

  /* Chap chekka hinge crease da — multiply qoldirilmaydi (korishok/blend xatosi) */
  fillMultiplyBand(ctx, edgeInset(quad, 'right', edgeFraction), 0.65);
  fillMultiplyBand(ctx, edgeInset(quad, 'bottom', edgeFraction), 0.7);

  ctx.globalCompositeOperation = prevOp || 'source-over';
  ctx.globalAlpha = prevAlpha;
  ctx.restore();
};
