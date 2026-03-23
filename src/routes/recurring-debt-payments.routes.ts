import { Router } from 'express';
import * as recurringDebtPaymentsController from '../controllers/recurring-debt-payments.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// POST /api/recurring-debt-payments/process - Process pending payments (admin/cron)
router.post('/process', recurringDebtPaymentsController.processPendingPayments);

// GET /api/recurring-debt-payments - Get all recurring payments (with optional debtId filter)
router.get('/', recurringDebtPaymentsController.getRecurringDebtPayments);

// POST /api/recurring-debt-payments - Create a new recurring payment
router.post('/', recurringDebtPaymentsController.createRecurringDebtPayment);

// GET /api/recurring-debt-payments/:id - Get a single recurring payment
router.get('/:id', recurringDebtPaymentsController.getRecurringDebtPaymentById);

// PATCH /api/recurring-debt-payments/:id - Update a recurring payment
router.patch('/:id', recurringDebtPaymentsController.updateRecurringDebtPayment);

// DELETE /api/recurring-debt-payments/:id - Delete a recurring payment
router.delete('/:id', recurringDebtPaymentsController.deleteRecurringDebtPayment);

export default router;
