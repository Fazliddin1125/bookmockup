import mongoose from 'mongoose';
import Template from '../models/Template.js';
import Category from '../models/Category.js';
import { saveTemplateFile, deleteTemplateFile } from '../utils/fileStorage.js';

const isValidPoint = (point) =>
  point &&
  typeof point === 'object' &&
  Number.isFinite(Number(point.x)) &&
  Number.isFinite(Number(point.y));

const validateQuad = (coords, fieldName) => {
  if (!Array.isArray(coords) || coords.length !== 4) {
    return `${fieldName}: требуется ровно 4 точки {x, y}`;
  }
  for (let i = 0; i < coords.length; i += 1) {
    if (!isValidPoint(coords[i])) {
      return `${fieldName}[${i}]: координаты x и y должны быть числами`;
    }
  }
  return null;
};

const parseSpineBow = (value, fallback = 0) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(-240, Math.min(240, Math.round(num)));
};

const parseSpineCurvature = (value, fallback = 0) => parseSpineBow(value, fallback);

const parseSpineMode = (value) => (value === 'slice' ? 'slice' : 'solid');

const parseLayoutMode = (value) => (value === '2d' ? '2d' : '3d');

const parseSpineColor = (value) => {
  const raw = String(value || '#334155').trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : '#334155';
};

const parseSpineColorAuto = (value) => value === true || value === 'true';

const parseSpineOffsetY = (value, fallback = 0) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(-160, Math.min(160, Math.round(num)));
};

const parseCategoryId = async (value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const raw = String(value).trim();
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    throw new Error('Некорректный идентификатор категории');
  }
  const category = await Category.findById(raw);
  if (!category) {
    throw new Error('Категория не найдена');
  }
  return category._id;
};

const parseCoordsField = (value, fieldName) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`Неверный формат JSON для ${fieldName}`);
    }
  }
  return value;
};

const toPublicTemplate = (doc) => {
  const item = doc.toObject ? doc.toObject() : doc;
  const category =
    item.categoryId && typeof item.categoryId === 'object'
      ? {
          _id: item.categoryId._id,
          name: item.categoryId.name,
          slug: item.categoryId.slug,
        }
      : item.categoryId || null;
  return {
    ...item,
    categoryId: category?._id ?? item.categoryId ?? null,
    category,
    bgImageUrl: item.bgImage,
  };
};

export const getTemplates = async (_req, res) => {
  try {
    const templates = await Template.find()
      .populate('categoryId', 'name slug parentId sortOrder')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({
      success: true,
      data: templates.map((t) => toPublicTemplate(t)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Не удалось загрузить список шаблонов',
      error: error.message,
    });
  }
};

export const getTemplateById = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id)
      .populate('categoryId', 'name slug parentId sortOrder')
      .lean();
    if (!template) {
      return res.status(404).json({ success: false, message: 'Шаблон не найден' });
    }
    return res.status(200).json({
      success: true,
      data: toPublicTemplate(template),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Не удалось загрузить шаблон',
      error: error.message,
    });
  }
};

export const createTemplate = async (req, res) => {
  let savedPath = null;

  try {
    const { title, isPremium } = req.body;
    const coverCoords = parseCoordsField(req.body.coverCoords, 'coverCoords');
    const spineCoords = parseCoordsField(req.body.spineCoords, 'spineCoords');
    const spineCurvature = parseSpineCurvature(req.body.spineCurvature);
    const spineBowTop = parseSpineBow(req.body.spineBowTop);
    const spineBowBottom = parseSpineBow(req.body.spineBowBottom);
    const spineMode = parseSpineMode(req.body.spineMode);
    const layoutMode = parseLayoutMode(req.body.layoutMode);
    const spineColor = parseSpineColor(req.body.spineColor);
    const spineColorAuto = parseSpineColorAuto(req.body.spineColorAuto);
    const spineOffsetY = parseSpineOffsetY(req.body.spineOffsetY);
    const categoryId = await parseCategoryId(req.body.categoryId);

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Укажите название шаблона' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Требуется файл изображения шаблона' });
    }

    const coverError = validateQuad(coverCoords, 'coverCoords');
    if (coverError) {
      return res.status(400).json({ success: false, message: coverError });
    }

    if (layoutMode !== '2d') {
      const spineError = validateQuad(spineCoords, 'spineCoords');
      if (spineError) {
        return res.status(400).json({ success: false, message: spineError });
      }
    }

    savedPath = await saveTemplateFile(req.file.buffer, req.file.originalname, req.file.mimetype);

    const template = await Template.create({
      title: title.trim(),
      categoryId,
      bgImage: savedPath,
      isPremium: isPremium === true || isPremium === 'true',
      coverCoords: coverCoords.map((p) => ({ x: Number(p.x), y: Number(p.y) })),
      spineCoords:
        layoutMode === '2d'
          ? coverCoords.map((p) => ({ x: Number(p.x), y: Number(p.y) }))
          : spineCoords.map((p) => ({ x: Number(p.x), y: Number(p.y) })),
      spineCurvature,
      spineBowTop,
      spineBowBottom,
      spineMode,
      layoutMode,
      spineColor,
      spineColorAuto,
      spineOffsetY,
    });

    const populated = await Template.findById(template._id).populate(
      'categoryId',
      'name slug parentId sortOrder'
    );
    return res.status(201).json({ success: true, data: toPublicTemplate(populated) });
  } catch (error) {
    if (savedPath) {
      await deleteTemplateFile(savedPath);
    }
    const status = error.message?.includes('категор') ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Не удалось создать шаблон',
    });
  }
};

export const updateTemplate = async (req, res) => {
  let savedPath = null;
  let oldBgImage = null;

  try {
    const { id } = req.params;
    const existing = await Template.findById(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Шаблон не найден' });
    }

    const { title, isPremium } = req.body;
    const coverCoords = parseCoordsField(req.body.coverCoords, 'coverCoords');
    const spineCoords = parseCoordsField(req.body.spineCoords, 'spineCoords');
    const spineCurvature = parseSpineCurvature(
      req.body.spineCurvature,
      existing.spineCurvature ?? 0
    );
    const spineBowTop = parseSpineBow(
      req.body.spineBowTop,
      existing.spineBowTop ?? 0
    );
    const spineBowBottom = parseSpineBow(
      req.body.spineBowBottom,
      existing.spineBowBottom ?? existing.spineCurvature ?? 0
    );
    const spineOffsetY = parseSpineOffsetY(
      req.body.spineOffsetY,
      existing.spineOffsetY ?? 0
    );
    const spineMode = parseSpineMode(req.body.spineMode ?? existing.spineMode);
    const layoutMode = parseLayoutMode(req.body.layoutMode ?? existing.layoutMode);
    const spineColor = parseSpineColor(req.body.spineColor ?? existing.spineColor);
    const spineColorAuto = parseSpineColorAuto(
      req.body.spineColorAuto ?? existing.spineColorAuto
    );
    const categoryId =
      req.body.categoryId !== undefined
        ? await parseCategoryId(req.body.categoryId)
        : existing.categoryId;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Укажите название шаблона' });
    }

    const coverError = validateQuad(coverCoords, 'coverCoords');
    if (coverError) {
      return res.status(400).json({ success: false, message: coverError });
    }

    if (layoutMode !== '2d') {
      const spineError = validateQuad(spineCoords, 'spineCoords');
      if (spineError) {
        return res.status(400).json({ success: false, message: spineError });
      }
    }

    const updates = {
      title: title.trim(),
      categoryId,
      isPremium: isPremium === true || isPremium === 'true',
      coverCoords: coverCoords.map((p) => ({ x: Number(p.x), y: Number(p.y) })),
      spineCoords:
        layoutMode === '2d'
          ? coverCoords.map((p) => ({ x: Number(p.x), y: Number(p.y) }))
          : spineCoords.map((p) => ({ x: Number(p.x), y: Number(p.y) })),
      spineCurvature,
      spineBowTop,
      spineBowBottom,
      spineOffsetY,
      spineMode,
      layoutMode,
      spineColor,
      spineColorAuto,
    };

    if (req.file) {
      savedPath = await saveTemplateFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      oldBgImage = existing.bgImage;
      updates.bgImage = savedPath;
    }

    const template = await Template.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate('categoryId', 'name slug parentId sortOrder');

    if (oldBgImage) {
      await deleteTemplateFile(oldBgImage);
    }

    return res.status(200).json({ success: true, data: toPublicTemplate(template) });
  } catch (error) {
    if (savedPath) {
      await deleteTemplateFile(savedPath);
    }
    const status = error.message?.includes('категор') ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Не удалось обновить шаблон',
    });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Template.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(400).json({ success: false, message: 'Шаблон не найден' });
    }

    await deleteTemplateFile(deleted.bgImage);

    return res.status(200).json({ success: true, message: 'Шаблон удалён', data: deleted });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Не удалось удалить шаблон',
      error: error.message,
    });
  }
};
