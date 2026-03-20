import { Router } from 'express';
import * as fixedExpensesController from '../controllers/fixed-expenses.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/summary', fixedExpensesController.getFixedExpensesSummary);
router.get('/', fixedExpensesController.getFixedExpenses);
router.post('/', fixedExpensesController.createFixedExpense);
router.get('/:id', fixedExpensesController.getFixedExpenseById);
router.patch('/:id', fixedExpensesController.updateFixedExpense);
router.delete('/:id', fixedExpensesController.deleteFixedExpense);
router.post('/:id/pay', fixedExpensesController.payFixedExpense);

export default router;
