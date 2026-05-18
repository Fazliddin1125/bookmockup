import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createTemplate,
  deleteTemplate,
  fetchTemplateById,
  fetchTemplates,
  updateTemplate,
} from '../api/templates.js';
import { mediaUrl } from '../api/config.js';
import CoordOverlay from './CoordOverlay.jsx';
import {
  applySpineOffsetY,
  getBottomBowControlPoint,
  getTopBowControlPoint,
  MAX_SPINE_BOW,
  MAX_SPINE_OFFSET_Y,
  normalizeSpineBow,
  normalizeSpineOffsetY,
  resolveSpineBows,
  spineBowBottomFromControlPoint,
  spineBowTopFromControlPoint,
} from '../utils/spineCurvature.js';
import { SPINE_MODES, normalizeSpineMode } from '../utils/spineSource.js';

const CANVAS_SIZE = 1024;

const DEFAULT_COVER = [
  { x: 420, y: 180 },
  { x: 860, y: 220 },
  { x: 820, y: 820 },
  { x: 380, y: 780 },
];

const DEFAULT_SPINE = [
  { x: 360, y: 200 },
  { x: 420, y: 180 },
  { x: 380, y: 780 },
  { x: 340, y: 760 },
];

const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL'];

function DraggableMarker({ point, color, label, onMouseDragStart, onTouchDragStart }) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

  return (
    <button
      type="button"
      aria-label={`Маркер ${label}`}
      onMouseDown={onMouseDragStart}
      onTouchStart={onTouchDragStart}
      className="admin-marker absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{ left: `${(point.x / CANVAS_SIZE) * 100}%`, top: `${(point.y / CANVAS_SIZE) * 100}%` }}
    >
      <span className={`admin-marker-dot ${color}`} />
      <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white">
        {label}
      </span>
    </button>
  );
}

export default function AdminPanel() {
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [bgPreview, setBgPreview] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [coverCoords, setCoverCoords] = useState(DEFAULT_COVER);
  const [spineCoords, setSpineCoords] = useState(DEFAULT_SPINE);
  const [spineBowTop, setSpineBowTop] = useState(0);
  const [spineBowBottom, setSpineBowBottom] = useState(0);
  const [spineOffsetY, setSpineOffsetY] = useState(0);
  const [spineMode, setSpineMode] = useState(SPINE_MODES.SOLID);
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const workspaceRef = useRef(null);
  const dragTargetRef = useRef(null);
  const previewObjectUrlRef = useRef(null);

  const revokePreviewUrl = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  };

  const resetForm = useCallback(() => {
    revokePreviewUrl();
    setEditingId(null);
    setTitle('');
    setIsPremium(false);
    setImageFile(null);
    setBgPreview('');
    setCoverCoords(DEFAULT_COVER);
    setSpineCoords(DEFAULT_SPINE);
    setSpineBowTop(0);
    setSpineBowBottom(0);
    setSpineOffsetY(0);
    setSpineMode(SPINE_MODES.SOLID);
  }, []);

  const displaySpineCoords = useMemo(
    () => applySpineOffsetY(spineCoords, spineOffsetY),
    [spineCoords, spineOffsetY]
  );

  const loadTemplates = useCallback(async () => {
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (error) {
      setStatus(error.message);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    return () => revokePreviewUrl();
  }, [loadTemplates]);

  const applyTemplateToForm = useCallback((template) => {
    if (!template?._id) return;
    setEditingId(template._id);
    setTitle(template.title || '');
    setIsPremium(Boolean(template.isPremium));
    setCoverCoords((template.coverCoords || DEFAULT_COVER).map((p) => ({ x: p.x, y: p.y })));
    setSpineCoords((template.spineCoords || DEFAULT_SPINE).map((p) => ({ x: p.x, y: p.y })));
    const bows = resolveSpineBows(template);
    setSpineBowTop(bows.topBow);
    setSpineBowBottom(bows.bottomBow);
    setSpineMode(normalizeSpineMode(template.spineMode));
    setSpineOffsetY(normalizeSpineOffsetY(template.spineOffsetY));
    setImageFile(null);
    setBgPreview(mediaUrl(template.bgImage));
  }, []);

  const startEdit = async (template) => {
    revokePreviewUrl();
    try {
      const fresh = await fetchTemplateById(template._id);
      applyTemplateToForm(fresh);
      setStatus(`Редактирование: «${fresh.title}»`);
    } catch (error) {
      applyTemplateToForm(template);
      setStatus(error.message);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const displayToCanvas = useCallback((clientX, clientY) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const relativeX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const relativeY = Math.min(Math.max(clientY - rect.top, 0), rect.height);

    return {
      x: Math.round((relativeX / rect.width) * CANVAS_SIZE),
      y: Math.round((relativeY / rect.height) * CANVAS_SIZE),
    };
  }, []);

  const updateMarker = useCallback(
    (target, point) => {
      if (target === 'spine-bow-top') {
        setSpineBowTop(spineBowTopFromControlPoint(displaySpineCoords, point));
        return;
      }
      if (target === 'spine-bow-bottom') {
        setSpineBowBottom(spineBowBottomFromControlPoint(displaySpineCoords, point));
        return;
      }

      if (target.startsWith('cover-')) {
        const index = Number(target.split('-')[1]);
        if (!Number.isNaN(index)) {
          setCoverCoords((prev) => prev.map((coord, idx) => (idx === index ? point : coord)));
        }
        return;
      }

      if (target.startsWith('spine-')) {
        const index = Number(target.split('-')[1]);
        if (!Number.isNaN(index)) {
          setSpineCoords((prev) =>
            prev.map((coord, idx) =>
              idx === index ? { x: point.x, y: point.y - spineOffsetY } : coord
            )
          );
        }
      }
    },
    [displaySpineCoords, spineOffsetY]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!dragTargetRef.current) return;

      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;
      const point = displayToCanvas(clientX, clientY);
      if (point) {
        updateMarker(dragTargetRef.current, point);
      }
    },
    [displayToCanvas, updateMarker]
  );

  const endDrag = useCallback(() => {
    dragTargetRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', endDrag);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', endDrag);
    };
  }, [handlePointerMove, endDrag]);

  const startDrag = (event, group, index) => {
    event.preventDefault();
    event.stopPropagation();
    dragTargetRef.current = `${group}-${index}`;
  };

  const makeDragHandlers = (group, index) => ({
    onMouseDragStart: (e) => startDrag(e, group, index),
    onTouchDragStart: (e) => startDrag(e, group, index),
  });

  const topBowControlPoint = getTopBowControlPoint(displaySpineCoords, spineBowTop);
  const bottomBowControlPoint = getBottomBowControlPoint(
    displaySpineCoords,
    spineBowBottom
  );

  const handleBackgroundUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    revokePreviewUrl();
    previewObjectUrlRef.current = URL.createObjectURL(file);
    setImageFile(file);
    setBgPreview(previewObjectUrlRef.current);
    setStatus('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!title.trim()) {
      setStatus('Укажите название шаблона.');
      return;
    }

    if (!editingId && !imageFile) {
      setStatus('Загрузите изображение для нового шаблона.');
      return;
    }

    if (!bgPreview) {
      setStatus('Требуется изображение шаблона.');
      return;
    }

    setIsSubmitting(true);
    setStatus(editingId ? 'Сохранение изменений…' : 'Сохранение на сервер…');

    try {
      const topToSave = normalizeSpineBow(spineBowTop);
      const bottomToSave = normalizeSpineBow(spineBowBottom);
      const offsetToSave = normalizeSpineOffsetY(spineOffsetY);

      if (editingId) {
        const saved = await updateTemplate({
          id: editingId,
          title: title.trim(),
          isPremium,
          coverCoords,
          spineCoords,
          spineBowTop: topToSave,
          spineBowBottom: bottomToSave,
          spineOffsetY: offsetToSave,
          spineMode,
          imageFile: imageFile || undefined,
        });
        await loadTemplates();
        applyTemplateToForm(saved);
        const savedBows = resolveSpineBows(saved);
        setStatus(
          `Шаблон обновлён. Yuqori: ${savedBows.topBow}px, pastki: ${savedBows.bottomBow}px, Y: ${saved.spineOffsetY ?? offsetToSave}px`
        );
      } else {
        await createTemplate({
          title: title.trim(),
          isPremium,
          coverCoords,
          spineCoords,
          spineBowTop: topToSave,
          spineBowBottom: bottomToSave,
          spineOffsetY: offsetToSave,
          spineMode,
          imageFile,
        });
        setStatus('Новый шаблон сохранён.');
        resetForm();
        await loadTemplates();
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот шаблон?')) return;

    try {
      if (editingId === id) {
        resetForm();
      }
      await deleteTemplate(id);
      await loadTemplates();
      setStatus('Шаблон удалён.');
    } catch (error) {
      setStatus(error.message);
    }
  };

  const isEditing = Boolean(editingId);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="glass-panel p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">
            {isEditing ? 'Редактирование шаблона' : 'Новый шаблон'}
          </h2>
          {isEditing && (
            <span className="rounded-full bg-gold-500/20 px-3 py-1 text-xs font-semibold text-gold-400">
              Режим редактирования
            </span>
          )}
        </div>

        <p className="text-sm text-white/60 mb-4">
          Загрузите макет книги и укажите, куда поместить обложку. Синий — лицевая сторона,
          оранжевый — корешок.
        </p>
        <ul className="mb-6 flex flex-wrap gap-4 text-xs text-white/70">
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-blue-500" /> Обложка
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-orange-500" /> Корешок
          </li>
        </ul>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Название шаблона</span>
              <input
                className="input-field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Cosmic Space Hardcover"
                required
              />
            </label>
            <label className="flex items-end gap-3 pb-1">
              <input
                type="checkbox"
                checked={isPremium}
                onChange={(e) => setIsPremium(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-ink-800 text-gold-500 focus:ring-gold-500"
              />
              <span className="text-sm text-white/80">Премиум шаблон</span>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm text-white/70">
              Изображение шаблона {isEditing && '(необязательно — только для замены)'}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleBackgroundUpload}
              className="block w-full text-sm text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-gold-500 file:px-4 file:py-2 file:font-semibold file:text-ink-950 hover:file:brightness-110"
            />
          </label>

          <fieldset className="block space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <legend className="px-1 text-sm font-medium text-white/80">Корешок — способ (авто)</legend>
            <p className="text-xs text-white/50">
              Только из обложки клиента. Админ выбирает способ, не цвет.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex flex-1 cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3 has-[:checked]:border-amber-400/60 has-[:checked]:bg-amber-500/10">
                <input
                  type="radio"
                  name="spineMode"
                  value={SPINE_MODES.SOLID}
                  checked={spineMode === SPINE_MODES.SOLID}
                  onChange={() => setSpineMode(SPINE_MODES.SOLID)}
                  className="mt-1 accent-amber-400"
                />
                <span>
                  <span className="block text-sm font-semibold text-white">
                    Цвет из обложки клиента
                  </span>
                  <span className="mt-0.5 block text-xs text-white/55">
                    Однотонный корешок — цвет с левого края обложки
                  </span>
                </span>
              </label>

              <label className="flex flex-1 cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3 has-[:checked]:border-amber-400/60 has-[:checked]:bg-amber-500/10">
                <input
                  type="radio"
                  name="spineMode"
                  value={SPINE_MODES.SLICE}
                  checked={spineMode === SPINE_MODES.SLICE}
                  onChange={() => setSpineMode(SPINE_MODES.SLICE)}
                  className="mt-1 accent-amber-400"
                />
                <span>
                  <span className="block text-sm font-semibold text-white">
                    Край обложки клиента
                  </span>
                  <span className="mt-0.5 block text-xs text-white/55">
                    Узкая полоска слева (~2%) — продолжение картинки
                  </span>
                </span>
              </label>
            </div>

          </fieldset>

          <label className="block">
            <span className="mb-1.5 flex justify-between text-sm text-white/70">
              <span>Yuqori qirr — STL ↔ STR (marker T)</span>
              <span className="font-mono text-amber-400">
                {spineBowTop > 0 ? '+' : ''}
                {spineBowTop}px
              </span>
            </span>
            <input
              type="range"
              min={-MAX_SPINE_BOW}
              max={MAX_SPINE_BOW}
              value={spineBowTop}
              onChange={(e) => setSpineBowTop(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
            <p className="mt-1 text-xs text-white/45">
              Marker egri ustida: tashqariga +, ichkariga − (±{MAX_SPINE_BOW}px).
            </p>
          </label>

          <label className="block">
            <span className="mb-1.5 flex justify-between text-sm text-white/70">
              <span>Pastki qirr — SBL ↔ SBR (marker B)</span>
              <span className="font-mono text-amber-400">
                {spineBowBottom > 0 ? '+' : ''}
                {spineBowBottom}px
              </span>
            </span>
            <input
              type="range"
              min={-MAX_SPINE_BOW}
              max={MAX_SPINE_BOW}
              value={spineBowBottom}
              onChange={(e) => setSpineBowBottom(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex justify-between text-sm text-white/70">
              <span>Korishok — Y o‘qi (yuqori / past)</span>
              <span className="font-mono text-amber-400">
                {spineOffsetY > 0 ? '+' : ''}
                {spineOffsetY}px
              </span>
            </span>
            <input
              type="range"
              min={-MAX_SPINE_OFFSET_Y}
              max={MAX_SPINE_OFFSET_Y}
              value={spineOffsetY}
              onChange={(e) => setSpineOffsetY(normalizeSpineOffsetY(e.target.value))}
              className="w-full accent-amber-400"
            />
            <p className="mt-1 text-xs text-white/45">
              Butun korishok blokini vertikal siljitadi (nuqtalar o‘zgarmaydi, faqat renderda).
            </p>
          </label>

          <div
            ref={workspaceRef}
            className={`relative mx-auto aspect-square w-full max-w-[640px] overflow-hidden rounded-2xl border ${
              isEditing ? 'border-gold-500/50' : 'border-white/10'
            } bg-ink-800 ${bgPreview ? '' : 'flex items-center justify-center'}`}
          >
            {bgPreview ? (
              <>
                <img src={bgPreview} alt="Template background" className="h-full w-full object-contain" />
                <CoordOverlay
                  coverCoords={coverCoords}
                  spineCoords={displaySpineCoords}
                  spineBowTop={spineBowTop}
                  spineBowBottom={spineBowBottom}
                />
                {coverCoords.map((point, index) => (
                  <DraggableMarker
                    key={`cover-${index}`}
                    point={point}
                    color="bg-blue-500"
                    label={`C${CORNER_LABELS[index]}`}
                    {...makeDragHandlers('cover', index)}
                  />
                ))}
                {displaySpineCoords.map((point, index) => (
                  <DraggableMarker
                    key={`spine-${index}`}
                    point={point}
                    color="bg-orange-500"
                    label={`S${CORNER_LABELS[index]}`}
                    {...makeDragHandlers('spine', index)}
                  />
                ))}
                <DraggableMarker
                  key="spine-bow-top"
                  point={topBowControlPoint}
                  color="bg-amber-400"
                  label="T"
                  {...makeDragHandlers('spine-bow', 'top')}
                />
                <DraggableMarker
                  key="spine-bow-bottom"
                  point={bottomBowControlPoint}
                  color="bg-amber-400"
                  label="B"
                  {...makeDragHandlers('spine-bow', 'bottom')}
                />
              </>
            ) : (
              <p className="text-sm text-white/40 px-6 text-center">
                Загрузите изображение или выберите шаблон из списка для редактирования.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting
                ? 'Сохранение…'
                : isEditing
                  ? 'Сохранить изменения'
                  : 'Сохранить шаблон'}
            </button>
            {isEditing && (
              <button type="button" className="btn-ghost" onClick={resetForm} disabled={isSubmitting}>
                Отмена
              </button>
            )}
            {!isEditing && (
              <button
                type="button"
                className="btn-ghost"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                Очистить форму
              </button>
            )}
          </div>
          {status && <p className="text-sm text-gold-400">{status}</p>}
        </form>
      </section>

      <aside className="glass-panel p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Сохранённые шаблоны</h3>
        <ul className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
          {templates.map((template) => {
            const isActive = editingId === template._id;
            const bows = resolveSpineBows(template);
            return (
              <li
                key={template._id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                  isActive
                    ? 'border-gold-500 bg-gold-500/10 ring-1 ring-gold-500/40'
                    : 'border-white/10 bg-ink-800/60 hover:border-white/20'
                }`}
              >
                <button
                  type="button"
                  onClick={() => startEdit(template)}
                  className="flex flex-1 items-center gap-3 min-w-0 text-left"
                >
                  <img
                    src={mediaUrl(template.bgImage)}
                    alt={template.title}
                    className="h-14 w-14 shrink-0 rounded-lg object-cover border border-white/10"
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{template.title}</p>
                    <p className="text-xs text-white/50">
                      {template.isPremium ? 'Премиум' : 'Бесплатно'} · T {bows.topBow}px · B{' '}
                      {bows.bottomBow}px
                      {Number(template.spineOffsetY)
                        ? ` · Y${template.spineOffsetY > 0 ? '+' : ''}${template.spineOffsetY}`
                        : ''}
                      {' · '}
                      {new Date(template.createdAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs text-gold-300"
                    onClick={() => startEdit(template)}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs text-red-300 hover:text-red-200"
                    onClick={() => handleDelete(template._id)}
                  >
                    Удалить
                  </button>
                </div>
              </li>
            );
          })}
          {templates.length === 0 && (
            <p className="text-sm text-white/50">Шаблонов пока нет.</p>
          )}
        </ul>
      </aside>
    </div>
  );
}
