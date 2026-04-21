import { Router } from 'express';
import * as budgetsController from '../controllers/budgets.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', budgetsController.getBudgets);
router.post('/', budgetsController.createBudget);
router.patch('/:id', budgetsController.updateBudget);
router.delete('/:id', budgetsController.deleteBudget);

export default router;
