/** High-quality scaling for mockup canvas draws */
export const applyCanvasQuality = (ctx) => {
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) {
    ctx.imageSmoothingQuality = 'high';
  }
};
