import { Link } from 'react-router-dom';
import { mediaUrl } from '../api/config.js';

export default function TemplateGallery({ templates }) {
  const freeTemplates = templates.filter((t) => !t.isPremium);
  const premiumTemplates = templates.filter((t) => t.isPremium);

  const renderCard = (template) => (
    <article key={template._id} className="client-card group">
      <Link to={`/mockup/${template._id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
          <img
            src={mediaUrl(template.bgImage)}
            alt={template.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
          {template.isPremium ? (
            <span className="absolute right-2 top-2 rounded bg-amber-400 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-950 shadow">
              PRO
            </span>
          ) : (
            <span className="absolute right-2 top-2 rounded bg-emerald-500 px-2 py-0.5 text-[11px] font-bold uppercase text-white shadow">
              FREE
            </span>
          )}
        </div>
        <span className="client-cta block text-center">3D maket — {template.title}</span>
      </Link>
    </article>
  );

  return (
    <>
      <section className="client-hero border-b border-slate-200 bg-white py-12">
        <div className="client-shell !py-0">
          <h1 className="client-hero-title">3D Mockup xizmati</h1>
          <p className="client-hero-text">
            Shablonni tanlang, kitob muqovangizni JPG yoki PNG formatda yuklang — admin belgilagan
            koordinatalar bo&apos;yicha professional 3D maket tayyorlanadi.
          </p>
        </div>
      </section>

      <div className="client-shell">
        {freeTemplates.length > 0 && (
          <section id="free" className="mb-12 pt-4">
            <h2 className="client-section-title">Kitob maketlari — Bepul</h2>
            <div className="client-grid">{freeTemplates.map(renderCard)}</div>
          </section>
        )}

        {premiumTemplates.length > 0 && (
          <section id="premium" className="mb-12">
            <h2 className="client-section-title">Premium maketlar</h2>
            <p className="mb-5 text-sm text-slate-500">PRO belgili shablonlar premium obuna uchun.</p>
            <div className="client-grid">{premiumTemplates.map(renderCard)}</div>
          </section>
        )}

        {templates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-500">
            Hozircha shablon yo&apos;q. Admin paneldan shablon qo&apos;shing.
          </div>
        )}
      </div>
    </>
  );
}
