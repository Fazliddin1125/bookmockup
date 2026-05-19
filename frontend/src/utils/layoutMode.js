export const LAYOUT_MODES = {
  MODE_3D: '3d',
  MODE_2D: '2d',
};

export const normalizeLayoutMode = (value) =>
  value === LAYOUT_MODES.MODE_2D ? LAYOUT_MODES.MODE_2D : LAYOUT_MODES.MODE_3D;

export const is2DLayoutMode = (layoutMode) => normalizeLayoutMode(layoutMode) === LAYOUT_MODES.MODE_2D;
