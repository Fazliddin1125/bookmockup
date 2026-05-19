/** Admin workspace ↔ 1024×1024 render canvas mapping */

export const WORKSPACE_CANVAS_SIZE = 1024;

/**
 * object-contain fit rect inside container (for letterboxed display).
 */
export const getContainFitRect = (
  containerWidth,
  containerHeight,
  contentWidth = WORKSPACE_CANVAS_SIZE,
  contentHeight = WORKSPACE_CANVAS_SIZE
) => {
  if (!containerWidth || !containerHeight) return null;
  const scale = Math.min(containerWidth / contentWidth, containerHeight / contentHeight);
  const width = contentWidth * scale;
  const height = contentHeight * scale;
  return {
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
    width,
    height,
    scale,
  };
};

/** Sichqoncha → 1024 (object-contain maydoni) */
export const clientPointToCanvas = (clientX, clientY, containerRect) => {
  if (!containerRect) return null;
  const fit = getContainFitRect(containerRect.width, containerRect.height);
  if (!fit) return null;

  const relX = clientX - containerRect.left - fit.left;
  const relY = clientY - containerRect.top - fit.top;

  return {
    x: Math.round((relX / fit.width) * WORKSPACE_CANVAS_SIZE),
    y: Math.round((relY / fit.height) * WORKSPACE_CANVAS_SIZE),
  };
};
