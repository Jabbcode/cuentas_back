import { Router } from 'express';
import * as tagsController from '../controllers/tags.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', tagsController.getTags);
router.get('/summary', tagsController.getTagsSummary);
router.delete('/:id', tagsController.deleteTag);

export default router;
