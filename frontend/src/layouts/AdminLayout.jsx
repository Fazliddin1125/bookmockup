import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { adminLogout } from '../api/auth.js';

const NAV_ITEMS = [
  { to: '/admin/templates', label: 'Макеты шаблонов', end: false },
  { to: '/admin/categories', label: 'Категории макетов', end: false },
  { to: '/admin/users', label: 'Пользователи', end: false },
  { to: '/admin/articles', label: 'Статьи', end: false },
];

function navClass({ isActive }) {
  return `admin-nav-link${isActive ? ' admin-nav-link-active' : ''}`;
}

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    adminLogout();
    navigate('/login/admin', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1f2435_0%,_#0a0b10_55%)]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-400">
              Панель администратора
            </p>
            <h1 className="font-display text-lg font-bold text-white">Конструктор макетов</h1>
          </div>
          <div className="flex gap-2">
            <NavLink to="/" className="btn-ghost">
              Сайт
            </NavLink>
            <button type="button" className="btn-ghost text-red-300" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-none gap-0 lg:gap-4">
        <aside className="hidden w-56 shrink-0 border-r border-white/10 bg-ink-950/40 p-4 lg:block xl:w-64">
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Навигация
          </p>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="admin-main flex-1 overflow-x-hidden px-2 py-4 sm:px-3 lg:py-6">
          <nav className="mb-6 flex gap-2 overflow-x-auto lg:hidden">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={`${navClass} whitespace-nowrap text-xs`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
