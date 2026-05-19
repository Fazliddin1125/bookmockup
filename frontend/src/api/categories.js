import { apiRequest, authHeaders, apiUrl } from './config.js';

const parseJsonResponse = async (response, fallbackMessage) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Сервер не отвечает. Запустите backend.');
  }
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || fallbackMessage);
  }
  return payload;
};

export const fetchCategories = async () => {
  const payload = await apiRequest('/api/categories');
  return payload.data;
};

export const createCategory = async (body) => {
  const payload = await apiRequest('/api/categories', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return payload.data;
};

export const updateCategory = async (id, body) => {
  const payload = await apiRequest(`/api/categories/${id}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return payload.data;
};

export const deleteCategory = async (id) => {
  const response = await fetch(apiUrl(`/api/categories/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseJsonResponse(response, 'Не удалось удалить категорию');
};

/** Дерево → плоский список для &lt;select&gt; */
export const flattenCategoryTree = (tree, depth = 0) =>
  (tree || []).flatMap((node) => [
    { _id: node._id, name: node.name, slug: node.slug, depth },
    ...flattenCategoryTree(node.children, depth + 1),
  ]);
