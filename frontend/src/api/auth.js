import { apiRequest, authHeaders, setAuthToken, apiUrl } from './config.js';

export const adminLogin = async (username, password) => {
  const payload = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  setAuthToken(payload.data.token);
  return payload.data;
};

export const verifyAdminSession = async () => {
  try {
    const response = await fetch(apiUrl('/api/auth/me'), { headers: authHeaders() });
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      setAuthToken(null);
      throw new Error('Backend ishlamayapti');
    }

    const payload = await response.json();
    if (!response.ok) {
      setAuthToken(null);
      throw new Error(payload.message || 'Sessiya tugagan');
    }
    return payload.data;
  } catch (error) {
    setAuthToken(null);
    throw error;
  }
};

export const adminLogout = () => {
  setAuthToken(null);
};
