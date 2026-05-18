import { buildSpineCurveMesh, curvedSpinePathD } from '../utils/spineCurvature.js';

const CANVAS_SIZE = 1024;

export default function CoordOverlay({
  coverCoords,
  spineCoords,
  spineBowTop = 0,
  spineBowBottom = 0,
}) {
  const mesh = buildSpineCurveMesh(spineCoords, { topBow: spineBowTop, bottomBow: spineBowBottom });
  const curvedPath = mesh ? curvedSpinePathD(mesh.topCurve, mesh.bottomCurve) : '';

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      preserveAspectRatio="none"
    >
      {curvedPath ? (
        <path
          d={curvedPath}
          fill="rgba(249, 115, 22, 0.12)"
          stroke="#f97316"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <polygon
          points={(spineCoords || [])
            .filter((p) => p?.x != null)
            .map((p) => `${p.x},${p.y}`)
            .join(' ')}
          fill="rgba(249, 115, 22, 0.12)"
          stroke="#f97316"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polygon
        points={(coverCoords || [])
          .filter((p) => p?.x != null)
          .map((p) => `${p.x},${p.y}`)
          .join(' ')}
        fill="rgba(59, 130, 246, 0.12)"
        stroke="#3b82f6"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
