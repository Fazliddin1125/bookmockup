import { buildSpineCurveMesh, curvedSpinePathD } from '../utils/spineCurvature.js';
import { getHingeCreaseSegment } from '../utils/mockup2d.js';

const CANVAS_SIZE = 1024;

export default function CoordOverlay({
  coverCoords,
  spineCoords,
  spineBowTop = 0,
  spineBowBottom = 0,
  is2DMode = false,
}) {
  const mesh =
    !is2DMode && buildSpineCurveMesh(spineCoords, { topBow: spineBowTop, bottomBow: spineBowBottom });
  const curvedPath = mesh ? curvedSpinePathD(mesh.topCurve, mesh.bottomCurve) : '';
  const hinge = is2DMode ? getHingeCreaseSegment(coverCoords) : null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      preserveAspectRatio="none"
    >
      {!is2DMode &&
        (curvedPath ? (
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
        ))}

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

      {hinge && (
        <>
          <line
            x1={hinge.top.x}
            y1={hinge.top.y}
            x2={hinge.bottom.x}
            y2={hinge.bottom.y}
            stroke="rgba(0, 0, 0, 0.75)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={hinge.top.x}
            y1={hinge.top.y}
            x2={hinge.bottom.x}
            y2={hinge.bottom.y}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}
