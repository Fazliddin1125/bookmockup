import { useCallback, useEffect, useState } from 'react';
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  flattenCategoryTree,
  updateCategory,
} from '../api/categories.js';

function CategoryRow({ node, depth, onRefresh, flatOptions }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [parentId, setParentId] = useState(node.parentId || '');
  const [sortOrder, setSortOrder] = useState(node.sortOrder ?? 0);
  const [status, setStatus] = useState('');

  const handleSave = async () => {
    try {
      await updateCategory(node._id, {
        name: name.trim(),
        parentId: parentId || null,
        sortOrder: Number(sortOrder) || 0,
      });
      setIsEditing(false);
      setStatus('');
      onRefresh();
    } catch (error) {
      setStatus(error.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Удалить категорию «${node.name}»?`)) return;
    try {
      await deleteCategory(node._id);
      onRefresh();
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <li className="space-y-2">
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-ink-800/60 p-3"
        style={{ marginLeft: depth * 16 }}
      >
        {isEditing ? (
          <>
            <input className="input-field flex-1 min-w-[140px]" value={name} onChange={(e) => setName(e.target.value)} />
            <select
              className="input-field min-w-[160px]"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">— корневая —</option>
              {flatOptions
                .filter((o) => o._id !== node._id)
                .map((o) => (
                  <option key={o._id} value={o._id}>
                    {'—'.repeat(o.depth + 1)} {o.name}
                  </option>
                ))}
            </select>
            <input
              type="number"
              className="input-field w-20"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
            <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={handleSave}>
              OK
            </button>
            <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => setIsEditing(false)}>
              Отмена
            </button>
          </>
        ) : (
          <>
            <span className="font-medium text-white">{node.name}</span>
            <span className="text-xs text-white/40 font-mono">{node.slug}</span>
            <span className="text-xs text-white/30">#{node.sortOrder ?? 0}</span>
            <div className="ml-auto flex gap-1">
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setIsEditing(true)}>
                Изменить
              </button>
              <button type="button" className="btn-ghost px-2 py-1 text-xs text-red-300" onClick={handleDelete}>
                Удалить
              </button>
            </div>
          </>
        )}
      </div>
      {status && <p className="text-xs text-red-300" style={{ marginLeft: depth * 16 }}>{status}</p>}
      {node.children?.length > 0 && (
        <ul className="space-y-2">
          {node.children.map((child) => (
            <CategoryRow
              key={child._id}
              node={child}
              depth={depth + 1}
              onRefresh={onRefresh}
              flatOptions={flatOptions}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function AdminCategories() {
  const [tree, setTree] = useState([]);
  const [flatOptions, setFlatOptions] = useState([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchCategories();
      setTree(data.tree || []);
      setFlatOptions(flattenCategoryTree(data.tree || []));
    } catch (error) {
      setStatus(error.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setStatus('Укажите название категории.');
      return;
    }
    try {
      await createCategory({
        name: name.trim(),
        slug: slug.trim() || undefined,
        parentId: parentId || null,
        sortOrder: Number(sortOrder) || 0,
      });
      setName('');
      setSlug('');
      setParentId('');
      setSortOrder(0);
      setStatus('Категория создана.');
      await load();
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-white">Категории макетов</h2>
        <p className="mt-2 text-sm text-white/55">
          Дерево категорий для галереи и привязки шаблонов в MongoDB.
        </p>
      </div>

      <form onSubmit={handleCreate} className="glass-panel space-y-4 p-6">
        <h3 className="text-sm font-semibold text-white/85">Новая категория</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">Название</span>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">Slug (необязательно)</span>
            <input className="input-field" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="free" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-white/60">Родительская категория</span>
            <select className="input-field" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— корневая —</option>
              {flatOptions.map((o) => (
                <option key={o._id} value={o._id}>
                  {'—'.repeat(o.depth + 1)} {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">Порядок сортировки</span>
            <input
              type="number"
              className="input-field"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </label>
        </div>
        <button type="submit" className="btn-primary">
          Добавить категорию
        </button>
      </form>

      <section className="glass-panel p-6">
        <h3 className="mb-4 text-sm font-semibold text-white/85">Дерево категорий</h3>
        {tree.length === 0 ? (
          <p className="text-sm text-white/45">Категорий пока нет. Запустите seedCategories или создайте вручную.</p>
        ) : (
          <ul className="space-y-2">
            {tree.map((node) => (
              <CategoryRow
                key={node._id}
                node={node}
                depth={0}
                onRefresh={load}
                flatOptions={flatOptions}
              />
            ))}
          </ul>
        )}
      </section>

      {status && <p className="text-sm text-gold-400">{status}</p>}
    </div>
  );
}
