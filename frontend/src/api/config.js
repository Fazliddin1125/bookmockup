export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const apiUrl = (path) => {
  if (!API_ORIGIN) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
};

export const mediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  return path.startsWith('/') ? `${API_ORIGIN}${path}` : `${API_ORIGIN}/${path}`;
};

export const getAuthToken = () => localStorage.getItem('adminToken');

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('adminToken', token);
  } else {
    localStorage.removeItem('adminToken');
  }
};

export const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function apiRequest(path, options = {}) {
  if (!API_ORIGIN && !path.startsWith('/')) {
    throw new Error(
      'VITE_API_URL не настроен. Vercel → Settings → Environment Variables'
    );
  }

  let response;
  try {
    response = await fetch(apiUrl(path), options);
  } catch {
    throw new Error(
      'Не удалось подключиться к серверу. Подождите 30 секунд и попробуйте снова (сервер мог уснуть).'
    );
  }
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const snippet = (await response.text()).slice(0, 80);
    if (snippet.startsWith('<!DOCTYPE') || snippet.startsWith('<html')) {
      throw new Error(
        'Сервер не отвечает. Запустите backend: cd backend && npm start'
      );
    }
    throw new Error(snippet || `Ошибка сервера (${response.status})`);
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || `Ошибка запроса (${response.status})`);
  }
  return payload;
}
