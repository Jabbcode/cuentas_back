import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/summary', dashboardController.getSummary);
router.get('/by-category', dashboardController.getByCategory);
router.get('/monthly-trend', dashboardController.getMonthlyTrend);
router.get('/fixed-vs-variable', dashboardController.getFixedVsVariable);
router.get('/next-month-projection', dashboardController.getNextMonthProjection);

export default router;
