import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../api/auth.js';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await adminLogin(username, password);
      navigate('/admin', { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1f2435_0%,_#0a0b10_55%)] flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="glass-panel w-full max-w-md p-8 space-y-5"
      >
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-gold-400 font-semibold">Админ</p>
          <h1 className="font-display text-2xl font-bold mt-1">Вход</h1>
          <p className="text-sm text-white/50 mt-2">/login/admin</p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm text-white/70">Логин</span>
          <input
            className="input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-white/70">Пароль</span>
          <input
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Вход…' : 'Войти в панель администратора'}
        </button>

        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => navigate('/')}
        >
          ← Вернуться на сайт
        </button>
      </form>
    </div>
  );
}
