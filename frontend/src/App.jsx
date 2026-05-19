import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import AdminCategories from './pages/AdminCategories.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminArticles from './pages/AdminArticles.jsx';
import ClientService from './components/ClientService.jsx';
import ClientLayout from './layouts/ClientLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import EditorPage from './pages/EditorPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<ClientLayout />}>
        <Route index element={<ClientService />} />
        <Route path="mockup/:id" element={<EditorPage />} />
      </Route>

      <Route path="/login/admin" element={<AdminLogin />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/templates" replace />} />
        <Route path="templates" element={<AdminPanel />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="articles" element={<AdminArticles />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
