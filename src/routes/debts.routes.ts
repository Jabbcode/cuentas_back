import { Router } from 'express';
import * as debtsController from '../controllers/debts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/debts/summary - Get debts summary for dashboard
router.get('/summary', debtsController.getDebtsSummary);

// GET /api/debts - Get all debts (with optional status filter)
router.get('/', debtsController.getDebts);

// POST /api/debts - Create a new debt
router.post('/', debtsController.createDebt);

// GET /api/debts/:id - Get a single debt
router.get('/:id', debtsController.getDebtById);

// PATCH /api/debts/:id - Update a debt
router.patch('/:id', debtsController.updateDebt);

// DELETE /api/debts/:id - Delete a debt
router.delete('/:id', debtsController.deleteDebt);

// POST /api/debts/:id/pay - Pay a debt
router.post('/:id/pay', debtsController.payDebt);

export default router;
