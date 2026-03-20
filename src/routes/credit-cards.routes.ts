import { Router } from 'express';
import * as creditCardsController from '../controllers/credit-cards.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/summary', creditCardsController.getSummary);
router.get('/:accountId/statement', creditCardsController.getStatement);
router.post('/:accountId/pay', creditCardsController.payStatement);

export default router;
