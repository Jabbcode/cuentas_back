import { Router } from 'express';
import * as categoriesController from '../controllers/categories.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', categoriesController.getCategories);
router.post('/', categoriesController.createCategory);
router.get('/:id/spending', categoriesController.getCategorySpending);
router.get('/:id', categoriesController.getCategoryById);
router.patch('/:id', categoriesController.updateCategory);
router.delete('/:id', categoriesController.deleteCategory);

export default router;
