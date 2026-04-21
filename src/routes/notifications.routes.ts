import { Router } from 'express';
import * as notificationsController from '../controllers/notifications.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', notificationsController.getNotifications);
router.patch('/read-all', notificationsController.markAllAsRead);
router.patch('/:id/read', notificationsController.markAsRead);
router.delete('/:id', notificationsController.deleteNotification);
router.get('/preferences', notificationsController.getPreferences);
router.patch('/preferences', notificationsController.updatePreferences);
router.post('/test-email', notificationsController.sendTestEmail);

export default router;
