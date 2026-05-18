import { Link, Outlet } from 'react-router-dom';

export default function ClientLayout() {
  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-emerald-600">
            BOOKMOCKUP
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <Link to="/" className="hover:text-emerald-600">
              Шаблоны
            </Link>
            <span className="text-slate-300">|</span>
            <a href="#free" className="hover:text-emerald-600">
              Бесплатно
            </a>
            <a href="#premium" className="hover:text-emerald-600">
              Premium
            </a>
          </nav>
          <Link
            to="/login/admin"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition"
          >
            Админ
          </Link>
        </div>
      </header>

      <Outlet />

      <footer className="mt-16 border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} BookMockup — генератор 3D макетов книг
      </footer>
    </div>
  );
}
