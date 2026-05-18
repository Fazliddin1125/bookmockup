import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { verifyAdminSession } from '../api/auth.js';

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    verifyAdminSession()
      .then(() => setStatus('ok'))
      .catch(() => setStatus('denied'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center text-white/60">
        Проверка доступа…
      </div>
    );
  }

  if (status === 'denied') {
    return <Navigate to="/login/admin" replace />;
  }

  return children;
}
