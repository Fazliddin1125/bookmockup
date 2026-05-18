export const API_ORIGIN = import.meta.env.VITE_API_URL || '';

export const apiUrl = (path) => `${API_ORIGIN}${path}`;

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
  const response = await fetch(apiUrl(path), options);
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const snippet = (await response.text()).slice(0, 80);
    if (snippet.startsWith('<!DOCTYPE') || snippet.startsWith('<html')) {
      throw new Error(
        'Backend javob bermadi. Terminalda ishga tushiring: cd backend && npm start'
      );
    }
    throw new Error(snippet || `Server xatosi (${response.status})`);
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || `So'rov xatosi (${response.status})`);
  }
  return payload;
}
