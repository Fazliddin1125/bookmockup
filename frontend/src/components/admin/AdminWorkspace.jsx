import { useLayoutEffect, useState } from 'react';
import CoordOverlay from '../CoordOverlay.jsx';
import DraggableMarker from './DraggableMarker.jsx';
import { getContainFitRect, WORKSPACE_CANVAS_SIZE } from '../../utils/workspaceCanvasFit.js';

const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL'];

/**
 * Workspace = 1024×1024 mantiqiy maydon.
 * Fon object-contain — proporsiya saqlanadi, cho‘zilmaydi.
 */
export default function AdminWorkspace({
  workspaceRef,
  bgPreview,
  isEditing,
  is2DMode = false,
  coverCoords,
  displaySpineCoords,
  spineBowTop,
  spineBowBottom,
  topBowControlPoint,
  bottomBowControlPoint,
  makeDragHandlers,
}) {
  const [layoutKey, setLayoutKey] = useState(0);
  const [fitBox, setFitBox] = useState(null);

  useLayoutEffect(() => {
    const el = workspaceRef?.current;
    if (!el) return undefined;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setFitBox(getContainFitRect(width, height));
      setLayoutKey((k) => k + 1);
    };

    update();

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [workspaceRef, bgPreview]);

  const getMarkerStyle = (point) => ({
    left: `${(point.x / WORKSPACE_CANVAS_SIZE) * 100}%`,
    top: `${(point.y / WORKSPACE_CANVAS_SIZE) * 100}%`,
  });

  return (
    <div
      ref={workspaceRef}
      className={`admin-coord-stage relative overflow-hidden rounded-2xl border ${
        isEditing ? 'border-gold-500/50' : 'border-white/10'
      } bg-ink-800 ${bgPreview ? '' : 'flex items-center justify-center'}`}
    >
      {bgPreview && fitBox ? (
        <div
          className="absolute"
          style={{
            left: fitBox.left,
            top: fitBox.top,
            width: fitBox.width,
            height: fitBox.height,
          }}
        >
          <img
            src={bgPreview}
            alt="Template background"
            className="pointer-events-none block h-full w-full rounded-sm object-contain"
            width={WORKSPACE_CANVAS_SIZE}
            height={WORKSPACE_CANVAS_SIZE}
            draggable={false}
          />
          <CoordOverlay
            coverCoords={coverCoords}
            spineCoords={displaySpineCoords}
            spineBowTop={spineBowTop}
            spineBowBottom={spineBowBottom}
            is2DMode={is2DMode}
          />
          {coverCoords.map((point, index) => (
            <DraggableMarker
              key={`cover-${index}-${layoutKey}`}
              point={point}
              positionStyle={getMarkerStyle(point)}
              variant="cover"
              label={`C${CORNER_LABELS[index]}`}
              {...makeDragHandlers('cover', index)}
            />
          ))}
          {!is2DMode && (
            <>
              {displaySpineCoords.map((point, index) => (
                <DraggableMarker
                  key={`spine-${index}-${layoutKey}`}
                  point={point}
                  positionStyle={getMarkerStyle(point)}
                  variant="spine"
                  label={`S${CORNER_LABELS[index]}`}
                  {...makeDragHandlers('spine', index)}
                />
              ))}
              <DraggableMarker
                key={`bow-top-${layoutKey}`}
                point={topBowControlPoint}
                positionStyle={getMarkerStyle(topBowControlPoint)}
                variant="bow"
                label="T"
                {...makeDragHandlers('spine-bow', 'top')}
              />
              <DraggableMarker
                key={`bow-bottom-${layoutKey}`}
                point={bottomBowControlPoint}
                positionStyle={getMarkerStyle(bottomBowControlPoint)}
                variant="bow"
                label="B"
                {...makeDragHandlers('spine-bow', 'bottom')}
              />
            </>
          )}
        </div>
      ) : bgPreview ? null : (
        <p className="px-6 text-center text-sm text-white/40">
          Загрузите изображение или выберите шаблон из списка.
        </p>
      )}
    </div>
  );
}
