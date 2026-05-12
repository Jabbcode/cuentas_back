import { Router } from 'express';
import { getProjection } from '../controllers/projection.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getProjection);

export default router;
