import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Template from '../models/Template.js';

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04FF]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'category';

const buildTree = (items, parentId = null) =>
  items
    .filter((item) => {
      const pid = item.parentId ? String(item.parentId) : null;
      const want = parentId ? String(parentId) : null;
      return pid === want;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'))
    .map((item) => ({
      ...item,
      children: buildTree(items, item._id),
    }));

export const getCategories = async (_req, res) => {
  try {
    const docs = await Category.find({ isActive: { $ne: false } })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const flat = docs.map((c) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
    }));

    return res.status(200).json({
      success: true,
      data: {
        flat,
        tree: buildTree(flat),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Не удалось загрузить категории',
      error: error.message,
    });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, slug, parentId, sortOrder } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Укажите название категории' });
    }

    let parent = null;
    if (parentId && String(parentId).trim()) {
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        return res.status(400).json({ success: false, message: 'Некорректный parentId' });
      }
      parent = await Category.findById(parentId);
      if (!parent) {
        return res.status(404).json({ success: false, message: 'Родительская категория не найдена' });
      }
    }

    const finalSlug = slugify(slug || name);
    const existing = await Category.findOne({ slug: finalSlug });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Категория с таким slug уже существует' });
    }

    const category = await Category.create({
      name: String(name).trim(),
      slug: finalSlug,
      parentId: parent?._id ?? null,
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    });

    return res.status(201).json({ success: true, data: category });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Не удалось создать категорию',
      error: error.message,
    });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, parentId, sortOrder, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Категория не найдена' });
    }

    if (name && String(name).trim()) {
      category.name = String(name).trim();
    }

    if (slug && String(slug).trim()) {
      const finalSlug = slugify(slug);
      const clash = await Category.findOne({ slug: finalSlug, _id: { $ne: id } });
      if (clash) {
        return res.status(409).json({ success: false, message: 'Категория с таким slug уже существует' });
      }
      category.slug = finalSlug;
    }

    if (parentId !== undefined) {
      if (!parentId || String(parentId).trim() === '') {
        category.parentId = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(parentId)) {
          return res.status(400).json({ success: false, message: 'Некорректный parentId' });
        }
        if (String(parentId) === String(id)) {
          return res.status(400).json({ success: false, message: 'Категория не может быть родителем самой себе' });
        }
        const parent = await Category.findById(parentId);
        if (!parent) {
          return res.status(404).json({ success: false, message: 'Родительская категория не найдена' });
        }
        category.parentId = parent._id;
      }
    }

    if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
      category.sortOrder = Number(sortOrder);
    }

    if (isActive !== undefined) {
      category.isActive = isActive === true || isActive === 'true';
    }

    await category.save();
    return res.status(200).json({ success: true, data: category });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Не удалось обновить категорию',
      error: error.message,
    });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Категория не найдена' });
    }

    const childCount = await Category.countDocuments({ parentId: id });
    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Сначала удалите или переместите дочерние категории',
      });
    }

    const templateCount = await Template.countDocuments({ categoryId: id });
    if (templateCount > 0) {
      return res.status(400).json({
        success: false,
        message: `В категории ${templateCount} шаблон(ов). Переназначьте их перед удалением.`,
      });
    }

    await category.deleteOne();
    return res.status(200).json({ success: true, message: 'Категория удалена' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Не удалось удалить категорию',
      error: error.message,
    });
  }
};
