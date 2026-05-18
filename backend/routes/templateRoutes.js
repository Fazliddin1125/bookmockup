import { Router } from 'express';
import {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../controllers/templateController.js';
import { requireAdmin } from '../middleware/authMiddleware.js';
import { uploadTemplateImage } from '../middleware/upload.js';

const router = Router();

router.get('/', getTemplates);
router.get('/:id', getTemplateById);
router.post('/', requireAdmin, uploadTemplateImage.single('templateImage'), createTemplate);
router.put('/:id', requireAdmin, uploadTemplateImage.single('templateImage'), updateTemplate);
router.delete('/:id', requireAdmin, deleteTemplate);

export default router;
