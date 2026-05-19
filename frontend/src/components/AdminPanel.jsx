import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createTemplate,
  deleteTemplate,
  fetchTemplateById,
  fetchTemplates,
  updateTemplate,
} from '../api/templates.js';
import { mediaUrl } from '../api/config.js';
import { fetchCategories, flattenCategoryTree } from '../api/categories.js';
import AdminMockupPreviewModal from './AdminMockupPreviewModal.jsx';
import AdminWorkspace from './admin/AdminWorkspace.jsx';
import { clientPointToCanvas, WORKSPACE_CANVAS_SIZE } from '../utils/workspaceCanvasFit.js';
import { loadImage } from '../utils/imageLoader.js';
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
import { LAYOUT_MODES, is2DLayoutMode, normalizeLayoutMode } from '../utils/layoutMode.js';
import { SPINE_MODES, normalizeSpineMode } from '../utils/spineSource.js';

const CANVAS_SIZE = WORKSPACE_CANVAS_SIZE;

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

const DEMO_COVER_URL = '/samples/demo-cover.png';

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
  const [layoutMode, setLayoutMode] = useState(LAYOUT_MODES.MODE_3D);
  const [categoryId, setCategoryId] = useState('');
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [testCoverImage, setTestCoverImage] = useState(null);
  const [testCoverName, setTestCoverName] = useState('');
  const [isTestCoverDragging, setIsTestCoverDragging] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRenderKey, setPreviewRenderKey] = useState(0);

  const workspaceRef = useRef(null);
  const dragTargetRef = useRef(null);
  const previewObjectUrlRef = useRef(null);
  const testCoverUrlRef = useRef(null);

  const revokePreviewUrl = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  };

  const revokeTestCoverUrl = () => {
    if (testCoverUrlRef.current) {
      URL.revokeObjectURL(testCoverUrlRef.current);
      testCoverUrlRef.current = null;
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
    setLayoutMode(LAYOUT_MODES.MODE_3D);
    setCategoryId('');
    revokeTestCoverUrl();
    setTestCoverImage(null);
    setTestCoverName('');
  }, []);

  const is2DMode = is2DLayoutMode(layoutMode);

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

  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchCategories();
      setCategoryOptions(flattenCategoryTree(data.tree || []));
    } catch {
      setCategoryOptions([]);
    }
  }, []);

  const loadDemoCover = useCallback(async () => {
    try {
      const img = await loadImage(DEMO_COVER_URL);
      setTestCoverImage(img);
      setTestCoverName('demo-cover.png');
    } catch {
      /* demo fayl yo‘q bo‘lsa — foydalanuvchi o‘zi yuklaydi */
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadCategories();
    loadDemoCover();
    return () => {
      revokePreviewUrl();
      revokeTestCoverUrl();
    };
  }, [loadTemplates, loadCategories, loadDemoCover]);

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
    setLayoutMode(normalizeLayoutMode(template.layoutMode));
    setSpineOffsetY(normalizeSpineOffsetY(template.spineOffsetY));
    setCategoryId(template.categoryId || template.category?._id || '');
    setImageFile(null);
    setBgPreview(mediaUrl(template.bgImage));
  }, []);

  const applyTestCoverFile = useCallback(async (file) => {
    if (!file?.type?.startsWith('image/')) {
      setStatus('Тестовая обложка: загрузите JPG или PNG.');
      return;
    }
    revokeTestCoverUrl();
    testCoverUrlRef.current = URL.createObjectURL(file);
    const img = await loadImage(testCoverUrlRef.current);
    setTestCoverImage(img);
    setTestCoverName(file.name);
    setStatus('');
  }, []);

  const handleTestCoverInput = (event) => {
    const file = event.target.files?.[0];
    if (file) applyTestCoverFile(file);
    event.target.value = '';
  };

  const handleTestCoverDrop = (event) => {
    event.preventDefault();
    setIsTestCoverDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) applyTestCoverFile(file);
  };

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

    const point = clientPointToCanvas(clientX, clientY, rect);
    if (!point) return null;

    return {
      x: Math.max(0, Math.min(CANVAS_SIZE, point.x)),
      y: Math.max(0, Math.min(CANVAS_SIZE, point.y)),
    };
  }, []);

  const updateMarker = useCallback(
    (target, point) => {
      if (!is2DMode && target === 'spine-bow-top') {
        setSpineBowTop(spineBowTopFromControlPoint(displaySpineCoords, point));
        return;
      }
      if (!is2DMode && target === 'spine-bow-bottom') {
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

      if (!is2DMode && target.startsWith('spine-')) {
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
    [displaySpineCoords, spineOffsetY, is2DMode]
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
          layoutMode,
          categoryId: categoryId || undefined,
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
          layoutMode,
          categoryId: categoryId || undefined,
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

  const openPreviewModal = () => {
    if (!bgPreview) {
      setStatus('Сначала загрузите фон шаблона.');
      return;
    }
    if (!testCoverImage) {
      setStatus('Загрузите тестовую обложку (или дождитесь загрузки демо).');
      return;
    }
    setPreviewRenderKey((k) => k + 1);
    setPreviewOpen(true);
    setStatus('');
  };

  const refreshPreviewModal = () => {
    setPreviewRenderKey((k) => k + 1);
  };

  return (
    <div className="admin-templates-root flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {isEditing ? 'Редактирование шаблона' : 'Новый шаблон'}
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Маркеры = 1024×1024 (как у клиента). Синий CTL→CTR→CBR→CBL, оранжевый STL→STR→SBR→SBL
          </p>
        </div>
        {isEditing && (
          <span className="rounded-full bg-gold-500/20 px-3 py-1 text-xs font-semibold text-gold-400">
            Режим редактирования
          </span>
        )}
      </div>

      <ul className="flex flex-wrap gap-4 px-1 text-xs text-white/70">
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-blue-500" /> Обложка
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-orange-500" /> Корешок
        </li>
      </ul>

      <form onSubmit={handleSubmit} className="admin-editor-stack">
        <details className="admin-settings-drawer p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-white/85">
            Настройки шаблона
          </summary>
          <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Категория макета</span>
              <select
                className="input-field"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— без категории —</option>
                {categoryOptions.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {'\u00A0'.repeat(cat.depth * 2)}
                    {cat.depth > 0 ? '└ ' : ''}
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-3 pb-1 sm:col-span-2">
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

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 has-[:checked]:border-gold-500/50 has-[:checked]:bg-gold-500/10">
            <input
              type="checkbox"
              checked={is2DMode}
              onChange={(e) =>
                setLayoutMode(e.target.checked ? LAYOUT_MODES.MODE_2D : LAYOUT_MODES.MODE_3D)
              }
              className="mt-1 h-4 w-4 rounded border-white/20 bg-ink-800 text-gold-500 focus:ring-gold-500"
            />
            <span>
              <span className="block text-sm font-semibold text-white">2D Mode</span>
              <span className="mt-0.5 block text-xs text-white/55">
                Faqat tekis muqova (4 burchak). Korishok o‘chiriladi; burilish chizig‘i va soyalar
                avtomatik.
              </span>
            </span>
          </label>

          {!is2DMode && (
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
          )}

          {!is2DMode && (
          <>
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
          </>
          )}

          <div
            className={`admin-test-cover-zone ${isTestCoverDragging ? 'admin-test-cover-zone-active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsTestCoverDragging(true);
            }}
            onDragLeave={() => setIsTestCoverDragging(false)}
            onDrop={handleTestCoverDrop}
          >
            <p className="text-sm font-medium text-white/80">Тестовая обложка</p>
            <p className="mt-1 text-xs text-white/45">
              Демо-обложка загружена автоматически. Замените своей JPG/PNG при необходимости.
            </p>
            <label className="btn-ghost mt-3 inline-block cursor-pointer text-sm">
              Другая обложка
              <input type="file" accept="image/*" className="hidden" onChange={handleTestCoverInput} />
            </label>
            {testCoverName && (
              <p className="mt-2 truncate text-xs text-amber-400/90">{testCoverName}</p>
            )}
          </div>
          </div>
        </details>

        <div className="admin-workspace-wrap">
          <AdminWorkspace
            workspaceRef={workspaceRef}
            bgPreview={bgPreview}
            isEditing={isEditing}
            is2DMode={is2DMode}
            coverCoords={coverCoords}
            displaySpineCoords={displaySpineCoords}
            spineBowTop={spineBowTop}
            spineBowBottom={spineBowBottom}
            topBowControlPoint={topBowControlPoint}
            bottomBowControlPoint={bottomBowControlPoint}
            makeDragHandlers={makeDragHandlers}
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-ink-900/50 p-4">
          <p className="mb-3 text-sm text-white/70">
            После расстановки координат откройте точный предпросмотр — так же увидит клиент.
          </p>
          <button
            type="button"
            className="btn-primary w-full sm:w-auto"
            onClick={openPreviewModal}
            disabled={!bgPreview || !testCoverImage}
          >
            Предпросмотр макета
          </button>
          {(!bgPreview || !testCoverImage) && (
            <p className="mt-2 text-xs text-white/40">
              Нужны фон шаблона и тестовая обложка
            </p>
          )}
        </div>

        <AdminMockupPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          renderKey={previewRenderKey}
          onRefresh={refreshPreviewModal}
          backgroundSrc={bgPreview}
          coverImage={testCoverImage}
          coverCoords={coverCoords}
          spineCoords={displaySpineCoords}
          spineBowTop={spineBowTop}
          spineBowBottom={spineBowBottom}
          spineMode={spineMode}
          spineOffsetY={spineOffsetY}
          layoutMode={layoutMode}
        />

        <div className="flex flex-wrap gap-3 px-1">
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
        {status && <p className="px-1 text-sm text-gold-400">{status}</p>}
      </form>

      <details className="admin-settings-drawer p-4">
        <summary className="cursor-pointer font-display text-lg font-semibold text-white/90">
          Сохранённые шаблоны ({templates.length})
        </summary>
        <ul className="admin-template-rail mt-4 space-y-3">
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
                      {template.category?.name ? `${template.category.name} · ` : ''}
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
      </details>
    </div>
  );
}
