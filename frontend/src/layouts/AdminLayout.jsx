import { Link, Outlet, useNavigate } from 'react-router-dom';
import { adminLogout } from '../api/auth.js';

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    adminLogout();
    navigate('/login/admin', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1f2435_0%,_#0a0b10_55%)]">
      <header className="border-b border-white/10 bg-ink-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-gold-400 font-semibold">Admin panel</p>
            <h1 className="font-display text-lg font-bold text-white">Shablon boshqaruvi</h1>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="btn-ghost">
              Sayt
            </Link>
            <button type="button" className="btn-ghost text-red-300" onClick={handleLogout}>
              Chiqish
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
