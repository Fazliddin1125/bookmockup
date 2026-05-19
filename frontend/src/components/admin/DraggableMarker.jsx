const MARKER_VARIANTS = {
  cover: {
    ring: 'rgba(59, 130, 246, 0.42)',
    ringBorder: 'rgba(96, 165, 250, 0.85)',
    core: '#3b82f6',
    crosshair: 'rgba(255, 255, 255, 0.95)',
  },
  spine: {
    ring: 'rgba(249, 115, 22, 0.42)',
    ringBorder: 'rgba(251, 146, 60, 0.9)',
    core: '#f97316',
    crosshair: 'rgba(255, 255, 255, 0.95)',
  },
  bow: {
    ring: 'rgba(251, 191, 36, 0.45)',
    ringBorder: 'rgba(252, 211, 77, 0.95)',
    core: '#fbbf24',
    crosshair: 'rgba(255, 255, 255, 0.95)',
  },
};

export default function DraggableMarker({
  point,
  positionStyle,
  variant = 'cover',
  label,
  onMouseDragStart,
  onTouchDragStart,
}) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

  const colors = MARKER_VARIANTS[variant] || MARKER_VARIANTS.cover;
  const style = positionStyle || { left: '50%', top: '50%' };

  return (
    <button
      type="button"
      aria-label={`Маркер ${label}`}
      onMouseDown={onMouseDragStart}
      onTouchStart={onTouchDragStart}
      className="admin-marker absolute z-20 -translate-x-1/2 -translate-y-1/2 touch-none select-none"
      style={style}
    >
      <span
        className="admin-marker-ring"
        style={{
          backgroundColor: colors.ring,
          borderColor: colors.ringBorder,
        }}
      />
      <span className="admin-marker-crosshair" style={{ backgroundColor: colors.crosshair }} />
      <span
        className="admin-marker-crosshair admin-marker-crosshair-v"
        style={{ backgroundColor: colors.crosshair }}
      />
      <span className="admin-marker-core" style={{ backgroundColor: colors.core }} />
      <span className="admin-marker-label">{label}</span>
    </button>
  );
}
