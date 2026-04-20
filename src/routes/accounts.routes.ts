import { Router } from 'express';
import * as accountsController from '../controllers/accounts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', accountsController.getAccounts);
router.post('/', accountsController.createAccount);
router.post('/transfer', accountsController.transferFunds);
router.get('/:id', accountsController.getAccountById);
router.get('/:id/transfers', accountsController.getTransfersByAccount);
router.patch('/:id', accountsController.updateAccount);
router.delete('/:id', accountsController.deleteAccount);

export default router;
