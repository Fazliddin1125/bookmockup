import { apiRequest, authHeaders, apiUrl } from './config.js';

const parseJsonResponse = async (response, fallbackMessage) => {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await response.text();
    if (text.includes('Cannot PUT') || text.includes('Cannot POST')) {
      throw new Error(
        'Backend eski versiyada. Terminalda: cd backend && npm start (qayta ishga tushiring)'
      );
    }
    throw new Error(
      'Backend javob bermadi. Terminalda: cd backend && npm start'
    );
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || fallbackMessage);
  }
  return payload;
};

export const fetchTemplates = async () => {
  const payload = await apiRequest('/api/templates');
  return payload.data;
};

export const fetchTemplateById = async (id) => {
  const payload = await apiRequest(`/api/templates/${id}`);
  return payload.data;
};

export const createTemplate = async ({ title, isPremium, coverCoords, spineCoords, imageFile }) => {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('isPremium', String(isPremium));
  formData.append('coverCoords', JSON.stringify(coverCoords));
  formData.append('spineCoords', JSON.stringify(spineCoords));
  formData.append('templateImage', imageFile);

  const response = await fetch(apiUrl('/api/templates'), {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  const payload = await parseJsonResponse(response, 'Shablon saqlanmadi');
  return payload.data;
};

export const updateTemplate = async ({
  id,
  title,
  isPremium,
  coverCoords,
  spineCoords,
  imageFile,
}) => {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('isPremium', String(isPremium));
  formData.append('coverCoords', JSON.stringify(coverCoords));
  formData.append('spineCoords', JSON.stringify(spineCoords));
  if (imageFile) {
    formData.append('templateImage', imageFile);
  }

  const response = await fetch(apiUrl(`/api/templates/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: formData,
  });

  const payload = await parseJsonResponse(response, 'Shablon yangilanmadi');
  return payload.data;
};

export const deleteTemplate = async (id) => {
  const payload = await apiRequest(`/api/templates/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return payload.data;
};
