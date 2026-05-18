import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminPanel from './components/AdminPanel.jsx';
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
        <Route index element={<AdminPanel />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
