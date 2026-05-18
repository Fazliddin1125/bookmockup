/** Spine — STL↔STR va SBL↔SBR qirrlari; marker egri ustidagi apex nuqtada */

export const SPINE_SEGMENTS = 48;
export const MAX_SPINE_BOW = 240;
export const MAX_SPINE_OFFSET_Y = 160;

export const lerpPoint = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const edgeMid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const quadPoint = (p0, p1, p2, t) => {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
};

/** Signed apex offset (px): + tashqariga, − ichkariga */
export const normalizeSpineBow = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(-MAX_SPINE_BOW, Math.min(MAX_SPINE_BOW, Math.round(num)));
};

export const resolveSpineBows = (template = {}) => {
  const legacy = normalizeSpineBow(template.spineCurvature);
  const hasTop = template.spineBowTop !== undefined && template.spineBowTop !== null;
  const hasBottom =
    template.spineBowBottom !== undefined && template.spineBowBottom !== null;
  return {
    topBow: hasTop ? normalizeSpineBow(template.spineBowTop) : 0,
    bottomBow: hasBottom ? normalizeSpineBow(template.spineBowBottom) : legacy,
  };
};

const getSpineFrame = (quad) => {
  const [tl, tr, br, bl] = quad;
  const hingeMid = edgeMid(tr, br);
  const outerMid = edgeMid(tl, bl);
  const bowLen = dist(outerMid, hingeMid) || 1;
  const normX = (outerMid.x - hingeMid.x) / bowLen;
  const normY = (outerMid.y - hingeMid.y) / bowLen;
  return { tl, tr, br, bl, normX, normY, bowLen };
};

/** Qirr bo‘yicha normal (tashqariga yo‘naltirilgan) */
const getEdgeBowFrame = (a, b, outward) => {
  const mid = lerpPoint(a, b, 0.5);
  const len = dist(a, b) || 1;
  const tanX = (b.x - a.x) / len;
  const tanY = (b.y - a.y) / len;
  let normX = -tanY;
  let normY = tanX;
  if (normX * outward.normX + normY * outward.normY < 0) {
    normX = -normX;
    normY = -normY;
  }
  return { mid, normX, normY, edgeLen: len };
};

const apexToControl = (mid, normX, normY, bow) => ({
  x: mid.x + normX * bow * 2,
  y: mid.y + normY * bow * 2,
});

const apexFromControl = (mid, normX, normY, control) =>
  (control.x - mid.x) * normX + (control.y - mid.y) * normY;

export const applySpineOffsetY = (coords, offsetY = 0) => {
  if (!Array.isArray(coords)) return coords;
  const dy = Math.round(Number(offsetY) || 0);
  if (dy === 0) return coords.map((p) => ({ x: p.x, y: p.y }));
  return coords.map((p) => ({ x: p.x, y: p.y + dy }));
};

export const normalizeSpineOffsetY = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(-MAX_SPINE_OFFSET_Y, Math.min(MAX_SPINE_OFFSET_Y, Math.round(num)));
};

export const normalizeQuad = (coords) => {
  if (!Array.isArray(coords)) return null;
  const points = coords
    .filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
    .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
  return points.length === 4 ? points : null;
};

export const buildSpineCurveMesh = (
  spineQuad,
  bows = {},
  segments = SPINE_SEGMENTS
) => {
  const quad = normalizeQuad(spineQuad);
  if (!quad) return null;

  const topBow = normalizeSpineBow(bows.topBow);
  const bottomBow = normalizeSpineBow(bows.bottomBow);
  const outward = getSpineFrame(quad);
  const { tl, tr, br, bl } = outward;

  const topFrame = getEdgeBowFrame(tl, tr, outward);
  const bottomFrame = getEdgeBowFrame(bl, br, outward);

  const topCtrl = apexToControl(topFrame.mid, topFrame.normX, topFrame.normY, topBow);
  const bottomCtrl = apexToControl(
    bottomFrame.mid,
    bottomFrame.normX,
    bottomFrame.normY,
    bottomBow
  );

  const topCurve = [];
  const bottomCurve = [];

  for (let i = 0; i <= segments; i += 1) {
    const v = i / segments;
    topCurve.push(quadPoint(tl, topCtrl, tr, v));
    bottomCurve.push(quadPoint(bl, bottomCtrl, br, v));
  }

  const strips = [];
  for (let i = 0; i < segments; i += 1) {
    strips.push({
      quad: [topCurve[i], topCurve[i + 1], bottomCurve[i + 1], bottomCurve[i]],
    });
  }

  return {
    topCurve,
    bottomCurve,
    topCtrl,
    bottomCtrl,
    topApex: {
      x: topFrame.mid.x + topFrame.normX * topBow,
      y: topFrame.mid.y + topFrame.normY * topBow,
    },
    bottomApex: {
      x: bottomFrame.mid.x + bottomFrame.normX * bottomBow,
      y: bottomFrame.mid.y + bottomFrame.normY * bottomBow,
    },
    outerNormal: { x: outward.normX, y: outward.normY },
  };
};

/** Marker — egri o‘rtasidagi apex (tortish aniq ko‘rinadi) */
export const getTopBowControlPoint = (spineQuad, topBow = 0) => {
  const quad = normalizeQuad(spineQuad);
  if (!quad) return { x: 512, y: 512 };
  const outward = getSpineFrame(quad);
  const { mid, normX, normY } = getEdgeBowFrame(outward.tl, outward.tr, outward);
  const bow = normalizeSpineBow(topBow);
  return { x: mid.x + normX * bow, y: mid.y + normY * bow };
};

export const getBottomBowControlPoint = (spineQuad, bottomBow = 0) => {
  const quad = normalizeQuad(spineQuad);
  if (!quad) return { x: 512, y: 512 };
  const outward = getSpineFrame(quad);
  const { mid, normX, normY } = getEdgeBowFrame(outward.bl, outward.br, outward);
  const bow = normalizeSpineBow(bottomBow);
  return { x: mid.x + normX * bow, y: mid.y + normY * bow };
};

export const spineBowTopFromControlPoint = (spineQuad, controlPoint) => {
  const quad = normalizeQuad(spineQuad);
  if (!quad || !controlPoint) return 0;
  const outward = getSpineFrame(quad);
  const { mid, normX, normY } = getEdgeBowFrame(outward.tl, outward.tr, outward);
  return normalizeSpineBow(apexFromControl(mid, normX, normY, controlPoint));
};

export const spineBowBottomFromControlPoint = (spineQuad, controlPoint) => {
  const quad = normalizeQuad(spineQuad);
  if (!quad || !controlPoint) return 0;
  const outward = getSpineFrame(quad);
  const { mid, normX, normY } = getEdgeBowFrame(outward.bl, outward.br, outward);
  return normalizeSpineBow(apexFromControl(mid, normX, normY, controlPoint));
};

export const curvedSpinePathD = (topCurve, bottomCurve) => {
  if (!topCurve?.length || !bottomCurve?.length) return '';
  const lastTop = topCurve[topCurve.length - 1];
  const lastBottom = bottomCurve[bottomCurve.length - 1];

  let d = `M ${topCurve[0].x} ${topCurve[0].y}`;
  for (let i = 1; i < topCurve.length; i += 1) {
    const prev = topCurve[i - 1];
    const curr = topCurve[i];
    d += ` Q ${prev.x} ${prev.y} ${(prev.x + curr.x) / 2} ${(prev.y + curr.y) / 2}`;
  }
  d += ` L ${lastTop.x} ${lastTop.y} L ${lastBottom.x} ${lastBottom.y}`;
  for (let i = bottomCurve.length - 2; i >= 0; i -= 1) {
    const prev = bottomCurve[i + 1];
    const curr = bottomCurve[i];
    d += ` Q ${prev.x} ${prev.y} ${(prev.x + curr.x) / 2} ${(prev.y + curr.y) / 2}`;
  }
  return `${d} L ${bottomCurve[0].x} ${bottomCurve[0].y} Z`;
};

export const pointInCurvedSpine = (px, py, topCurve, bottomCurve) => {
  if (!topCurve?.length || !bottomCurve?.length) return false;
  const polygon = [...topCurve, ...[...bottomCurve].reverse()];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const clipCurvedSpinePath = (ctx, topCurve, bottomCurve) => {
  if (!topCurve?.length || topCurve.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(topCurve[0].x, topCurve[0].y);
  for (let i = 1; i < topCurve.length; i += 1) {
    const prev = topCurve[i - 1];
    const curr = topCurve[i];
    ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
  }
  const lastTop = topCurve[topCurve.length - 1];
  const lastBottom = bottomCurve[bottomCurve.length - 1];
  ctx.lineTo(lastTop.x, lastTop.y);
  ctx.lineTo(lastBottom.x, lastBottom.y);
  for (let i = bottomCurve.length - 2; i >= 0; i -= 1) {
    const prev = bottomCurve[i + 1];
    const curr = bottomCurve[i];
    ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
  }
  ctx.lineTo(bottomCurve[0].x, bottomCurve[0].y);
  ctx.closePath();
  ctx.clip();
};
