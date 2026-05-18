import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createTemplate,
  deleteTemplate,
  fetchTemplates,
  updateTemplate,
} from '../api/templates.js';
import { mediaUrl } from '../api/config.js';
import CoordOverlay from './CoordOverlay.jsx';

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

function DraggableMarker({ point, color, label, onDragStart }) {
  return (
    <button
      type="button"
      aria-label={`${label} marker`}
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 touch-none"
      style={{ left: `${(point.x / CANVAS_SIZE) * 100}%`, top: `${(point.y / CANVAS_SIZE) * 100}%` }}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold shadow-lg ${color}`}
      >
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
  }, []);

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

  const startEdit = (template) => {
    revokePreviewUrl();
    setEditingId(template._id);
    setTitle(template.title);
    setIsPremium(Boolean(template.isPremium));
    setCoverCoords(template.coverCoords.map((p) => ({ x: p.x, y: p.y })));
    setSpineCoords(template.spineCoords.map((p) => ({ x: p.x, y: p.y })));
    setImageFile(null);
    setBgPreview(mediaUrl(template.bgImage));
    setStatus(`"${template.title}" tahrirlanmoqda`);
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

  const updateMarker = useCallback((target, point) => {
    if (target.startsWith('cover-')) {
      const index = Number(target.split('-')[1]);
      setCoverCoords((prev) => prev.map((coord, idx) => (idx === index ? point : coord)));
      return;
    }

    if (target.startsWith('spine-')) {
      const index = Number(target.split('-')[1]);
      setSpineCoords((prev) => prev.map((coord, idx) => (idx === index ? point : coord)));
    }
  }, []);

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
    dragTargetRef.current = `${group}-${index}`;
  };

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
      setStatus('Sarlavha kiritilishi shart.');
      return;
    }

    if (!editingId && !imageFile) {
      setStatus('Yangi shablon uchun rasm yuklang.');
      return;
    }

    if (!bgPreview) {
      setStatus('Shablon rasmi kerak.');
      return;
    }

    setIsSubmitting(true);
    setStatus(editingId ? 'O\'zgarishlar saqlanmoqda…' : 'Serverga saqlanmoqda…');

    try {
      if (editingId) {
        await updateTemplate({
          id: editingId,
          title: title.trim(),
          isPremium,
          coverCoords,
          spineCoords,
          imageFile: imageFile || undefined,
        });
        setStatus('Shablon yangilandi.');
      } else {
        await createTemplate({
          title: title.trim(),
          isPremium,
          coverCoords,
          spineCoords,
          imageFile,
        });
        setStatus('Yangi shablon saqlandi.');
      }

      resetForm();
      await loadTemplates();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Shablonni o\'chirishni tasdiqlaysizmi?')) return;

    try {
      if (editingId === id) {
        resetForm();
      }
      await deleteTemplate(id);
      await loadTemplates();
      setStatus('Shablon o\'chirildi.');
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
            {isEditing ? 'Shablonni tahrirlash' : 'Yangi shablon'}
          </h2>
          {isEditing && (
            <span className="rounded-full bg-gold-500/20 px-3 py-1 text-xs font-semibold text-gold-400">
              Tahrirlash rejimi
            </span>
          )}
        </div>

        <p className="text-sm text-white/60 mb-4">
          Kitob shablonini yuklang va muqova qayerga joylashini belgilang. Ko&apos;k — old muqova,
          to&apos;q sariq — orqa qirrasi (spine).
        </p>
        <ul className="mb-6 flex flex-wrap gap-4 text-xs text-white/70">
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-blue-500" /> Muqova (cover)
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-orange-500" /> Spine
          </li>
        </ul>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Shablon nomi</span>
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
              <span className="text-sm text-white/80">Premium shablon</span>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm text-white/70">
              Shablon rasmi {isEditing && '(ixtiyoriy — faqat almashtirish uchun)'}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleBackgroundUpload}
              className="block w-full text-sm text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-gold-500 file:px-4 file:py-2 file:font-semibold file:text-ink-950 hover:file:brightness-110"
            />
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
                <CoordOverlay coverCoords={coverCoords} spineCoords={spineCoords} />
                {coverCoords.map((point, index) => (
                  <DraggableMarker
                    key={`cover-${index}`}
                    point={point}
                    color="bg-blue-500"
                    label={`C${CORNER_LABELS[index]}`}
                    onDragStart={(event) => startDrag(event, 'cover', index)}
                  />
                ))}
                {spineCoords.map((point, index) => (
                  <DraggableMarker
                    key={`spine-${index}`}
                    point={point}
                    color="bg-orange-500"
                    label={`S${CORNER_LABELS[index]}`}
                    onDragStart={(event) => startDrag(event, 'spine', index)}
                  />
                ))}
              </>
            ) : (
              <p className="text-sm text-white/40 px-6 text-center">
                Shablon rasmini yuklang yoki ro&apos;yxatdan tahrirlashni tanlang.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting
                ? 'Saqlanmoqda…'
                : isEditing
                  ? 'O\'zgarishlarni saqlash'
                  : 'Shablonni saqlash'}
            </button>
            {isEditing && (
              <button type="button" className="btn-ghost" onClick={resetForm} disabled={isSubmitting}>
                Bekor qilish
              </button>
            )}
            {!isEditing && (
              <button
                type="button"
                className="btn-ghost"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                Formani tozalash
              </button>
            )}
          </div>
          {status && <p className="text-sm text-gold-400">{status}</p>}
        </form>
      </section>

      <aside className="glass-panel p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Saqlangan shablonlar</h3>
        <ul className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
          {templates.map((template) => {
            const isActive = editingId === template._id;
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
                      {template.isPremium ? 'Premium' : 'Free'} ·{' '}
                      {new Date(template.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs text-gold-300"
                    onClick={() => startEdit(template)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs text-red-300 hover:text-red-200"
                    onClick={() => handleDelete(template._id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
          {templates.length === 0 && (
            <p className="text-sm text-white/50">Hozircha shablon yo&apos;q.</p>
          )}
        </ul>
      </aside>
    </div>
  );
}
