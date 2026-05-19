import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { mediaUrl } from '../api/config.js';
import { applyCanvasQuality } from '../utils/canvasQuality.js';
import { CANVAS_DIMENSION, renderMockup } from '../utils/homography.js';
import { resolveSpineBows } from '../utils/spineCurvature.js';
import { loadImage, readFileAsDataUrl } from '../utils/imageLoader.js';

export default function MockupEditor({ template, isPremiumUser = false }) {
  const bgSrc = mediaUrl(template.bgImage);
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const canvasRef = useRef(null);
  const isLocked = template.isPremium && !isPremiumUser;

  const runRender = useCallback(async () => {
    if (!template || !coverImage || !canvasRef.current || isLocked) {
      return;
    }

    setIsRendering(true);
    setError('');

    try {
      const bows = resolveSpineBows(template);
      await renderMockup({
        canvas: canvasRef.current,
        backgroundSrc: bgSrc,
        coverImage,
        coverCoords: template.coverCoords,
        spineCoords: template.spineCoords,
        spineBowTop: bows.topBow,
        spineBowBottom: bows.bottomBow,
        spineMode: template.spineMode === 'slice' ? 'slice' : 'solid',
        spineOffsetY: template.spineOffsetY ?? 0,
        layoutMode: template.layoutMode ?? '3d',
        foregroundSrc: template.foregroundImage
          ? mediaUrl(template.foregroundImage)
          : null,
      });
    } catch (renderError) {
      setError(renderError.message || 'Ошибка генерации');
    } finally {
      setIsRendering(false);
    }
  }, [template, coverImage, isLocked, bgSrc]);

  useEffect(() => {
    if (!template || !canvasRef.current) return;

    const paintBackground = async () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      applyCanvasQuality(ctx);
      ctx.clearRect(0, 0, CANVAS_DIMENSION, CANVAS_DIMENSION);
      try {
        const bg = await loadImage(bgSrc);
        ctx.drawImage(bg, 0, 0, CANVAS_DIMENSION, CANVAS_DIMENSION);
      } catch (bgError) {
        setError(bgError.message);
      }
    };

    paintBackground();
    setCoverImage(null);
    setCoverPreview('');
  }, [template, bgSrc]);

  useEffect(() => {
    runRender();
  }, [runRender]);

  const applyCoverFile = async (file) => {
    if (isLocked) {
      setError('Этот шаблон Premium. Требуется подписка Premium.');
      return;
    }
    if (!file || !file.type.startsWith('image/')) {
      setError('Загрузите файл JPG или PNG.');
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setCoverPreview(dataUrl);
    const img = await loadImage(dataUrl);
    setCoverImage(img);
    setError('');
  };

  const handleFileInput = async (event) => {
    const file = event.target.files?.[0];
    if (file) await applyCoverFile(file);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDraggingFile(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await applyCoverFile(file);
  };

  const downloadMockup = () => {
    if (!canvasRef.current || !coverImage) return;
    const dataUrl = canvasRef.current.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${template.title}-mockup.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="client-shell">
      <Link to="/" className="client-back-link">
        ← Вернуться к шаблонам
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[380px_1fr]">
        <aside className="client-panel space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{template.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {template.isPremium ? 'Премиум шаблон' : 'Бесплатный шаблон'} · Загрузите обложку
            </p>
          </div>

          {isLocked && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Этот шаблон только для Premium. Выберите бесплатный шаблон.
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Обложка (лицевая сторона)</span>
              {coverPreview && !isLocked && (
                <span className="text-xs font-bold uppercase text-emerald-600">Загружено ✓</span>
              )}
            </div>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                if (!isLocked) setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={handleDrop}
              className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${
                isLocked
                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                  : isDraggingFile
                    ? 'border-emerald-500 bg-emerald-50'
                    : coverPreview
                      ? 'border-emerald-500 bg-white'
                      : 'border-slate-300 bg-slate-50 hover:border-emerald-400'
              }`}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                className="hidden"
                disabled={isLocked}
                onChange={handleFileInput}
              />
              {coverPreview ? (
                <>
                  <img
                    src={coverPreview}
                    alt="Обложка"
                    className="max-h-40 w-auto rounded-lg border border-slate-200 object-contain shadow-sm"
                  />
                  <span className="mt-3 text-xs font-medium uppercase text-slate-500">
                    Нажмите, чтобы изменить
                  </span>
                </>
              ) : (
                <>
                  <span className="text-4xl text-slate-400">+</span>
                  <span className="mt-2 font-medium text-slate-700">Загрузите JPG или PNG</span>
                  <span className="mt-1 text-xs text-slate-500">
                    Размещение по координатам администратора
                  </span>
                </>
              )}
            </label>
          </div>

          <button
            type="button"
            className="client-cta w-full disabled:cursor-not-allowed disabled:opacity-50"
            onClick={downloadMockup}
            disabled={!coverImage || isRendering || isLocked}
          >
            {isRendering ? 'Создание макета…' : 'Скачать готовый макет (PNG)'}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </aside>

        <section className="client-panel flex flex-col">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Результат</h2>
          {coverImage ? (
            <div className="mx-auto w-full max-w-[480px]">
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <canvas
                  id="generatorCanvas"
                  ref={canvasRef}
                  width={CANVAS_DIMENSION}
                  height={CANVAS_DIMENSION}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-24 text-center">
              <div className="mb-4 h-32 w-24 rounded bg-slate-200/80" />
              <p className="text-lg font-medium text-slate-600">Ваш результат</p>
              <p className="mt-1 text-sm text-slate-400">
                Появится здесь после загрузки обложки
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
