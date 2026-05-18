import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchTemplateById } from '../api/templates.js';
import MockupEditor from '../components/MockupEditor.jsx';

export default function EditorPage() {
  const { id } = useParams();
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTemplateById(id)
      .then(setTemplate)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="client-shell py-20 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link to="/" className="client-back-link">
          ← Вернуться к шаблонам
        </Link>
      </div>
    );
  }

  if (!template) {
    return <p className="client-shell py-20 text-center text-slate-500">Загрузка…</p>;
  }

  return <MockupEditor template={template} isPremiumUser={false} />;
}
