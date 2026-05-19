import { useEffect, useRef, useState } from 'react';
import { CANVAS_DIMENSION, renderMockup } from '../utils/homography.js';

/**
 * Рендер только когда active=true и меняется renderKey (не на каждый пиксель drag).
 */
export default function AdminLivePreview({
  active = false,
  renderKey = 0,
  backgroundSrc,
  coverImage,
  coverCoords,
  spineCoords,
  spineBowTop = 0,
  spineBowBottom = 0,
  spineMode = 'solid',
  spineOffsetY = 0,
  layoutMode = '3d',
  fullWidth = false,
}) {
  const canvasRef = useRef(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    if (!active) return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    if (!backgroundSrc || !coverImage) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, CANVAS_DIMENSION, CANVAS_DIMENSION);
      setRenderError('');
      setIsRendering(false);
      return undefined;
    }

    let cancelled = false;
    setIsRendering(true);
    setRenderError('');

    renderMockup({
      canvas,
      backgroundSrc,
      coverImage,
      coverCoords,
      spineCoords,
      spineBowTop,
      spineBowBottom,
      spineMode,
      spineOffsetY,
      layoutMode,
    })
      .catch((error) => {
        if (!cancelled) {
          setRenderError(error.message || 'Ошибка предпросмотра');
        }
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    active,
    renderKey,
    backgroundSrc,
    coverImage,
    coverCoords,
    spineCoords,
    spineBowTop,
    spineBowBottom,
    spineMode,
    spineOffsetY,
    layoutMode,
  ]);

  const waitingCover = Boolean(backgroundSrc) && !coverImage;
  const wrapClass = fullWidth ? 'admin-preview-stage' : 'admin-preview-canvas-wrap';
  const panelClass = fullWidth ? 'admin-preview-panel-full border-0 bg-transparent p-0' : 'admin-preview-panel';

  return (
    <div className={panelClass}>
      <div className="mb-2 flex items-center justify-between gap-2">
        {!fullWidth && (
          <h3 className="text-sm font-semibold text-white/90">Живой предпросмотр</h3>
        )}
        {isRendering && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-400/90">
            рендер…
          </span>
        )}
      </div>

      <div className={wrapClass}>
        <canvas
          ref={canvasRef}
          width={CANVAS_DIMENSION}
          height={CANVAS_DIMENSION}
          className="h-full w-full object-contain"
          aria-label="Предпросмотр макета с тестовой обложкой"
        />
        {waitingCover && (
          <p className="admin-preview-placeholder">
            Загрузите тестовую обложку
          </p>
        )}
        {!backgroundSrc && (
          <p className="admin-preview-placeholder">Сначала загрузите фон шаблона</p>
        )}
      </div>

      {renderError && <p className="mt-2 text-xs text-red-300">{renderError}</p>}
    </div>
  );
}
