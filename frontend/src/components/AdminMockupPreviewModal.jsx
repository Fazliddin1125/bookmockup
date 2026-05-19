import { useEffect } from 'react';
import AdminLivePreview from './AdminLivePreview.jsx';

export default function AdminMockupPreviewModal({
  open,
  onClose,
  renderKey,
  onRefresh,
  backgroundSrc,
  coverImage,
  coverCoords,
  spineCoords,
  spineBowTop,
  spineBowBottom,
  spineMode,
  spineOffsetY,
  layoutMode = '3d',
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const canRender = Boolean(backgroundSrc && coverImage);

  return (
    <div
      className="admin-preview-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-preview-modal-title"
      onClick={onClose}
    >
      <div className="admin-preview-modal" onClick={(e) => e.stopPropagation()}>
        <header className="admin-preview-modal-header">
          <div>
            <h2 id="admin-preview-modal-title" className="font-display text-lg font-semibold text-white">
              Предпросмотр макета
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Точный рендер для клиента. После изменения координат нажмите «Обновить».
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              disabled={!canRender}
              onClick={onRefresh}
            >
              Обновить
            </button>
            <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </header>

        <div className="admin-preview-modal-body">
          {!canRender ? (
            <p className="py-16 text-center text-sm text-white/50">
              Загрузите фон шаблона и тестовую обложку, затем откройте предпросмотр снова.
            </p>
          ) : (
            <AdminLivePreview
              active
              renderKey={renderKey}
              fullWidth
              backgroundSrc={backgroundSrc}
              coverImage={coverImage}
              coverCoords={coverCoords}
              spineCoords={spineCoords}
              spineBowTop={spineBowTop}
              spineBowBottom={spineBowBottom}
              spineMode={spineMode}
              spineOffsetY={spineOffsetY}
              layoutMode={layoutMode}
            />
          )}
        </div>
      </div>
    </div>
  );
}
