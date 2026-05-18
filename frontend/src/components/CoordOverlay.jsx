const CANVAS_SIZE = 1024;

export default function CoordOverlay({ coverCoords, spineCoords }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      preserveAspectRatio="none"
    >
      <polygon
        points={spineCoords.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="rgba(249, 115, 22, 0.12)"
        stroke="#f97316"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points={coverCoords.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="rgba(59, 130, 246, 0.12)"
        stroke="#3b82f6"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
      {spineCoords.map((point, index) => (
        <line
          key={`spine-edge-${index}`}
          x1={point.x}
          y1={point.y}
          x2={spineCoords[(index + 1) % 4].x}
          y2={spineCoords[(index + 1) % 4].y}
          stroke="#f97316"
          strokeWidth="4"
          strokeLinecap="round"
        />
      ))}
      {coverCoords.map((point, index) => (
        <line
          key={`cover-edge-${index}`}
          x1={point.x}
          y1={point.y}
          x2={coverCoords[(index + 1) % 4].x}
          y2={coverCoords[(index + 1) % 4].y}
          stroke="#3b82f6"
          strokeWidth="4"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
