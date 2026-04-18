import { Router } from 'express';
import * as transactionsController from '../controllers/transactions.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', transactionsController.getTransactions);
router.post('/', transactionsController.createTransaction);
router.get('/:id', transactionsController.getTransactionById);
router.get('/:id/items', transactionsController.getReceiptItems);
router.patch('/:id', transactionsController.updateTransaction);
router.delete('/:id', transactionsController.deleteTransaction);

export default router;
