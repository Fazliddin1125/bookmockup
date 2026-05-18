import { useEffect, useState } from 'react';
import { fetchTemplates } from '../api/templates.js';
import TemplateGallery from './TemplateGallery.jsx';

export default function ClientService() {
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchTemplates();
        setTemplates(data);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="client-shell py-20 text-center text-slate-500">Загрузка шаблонов…</div>
    );
  }

  return (
    <>
      {error && (
        <p className="client-shell mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <TemplateGallery templates={templates} />
    </>
  );
}
