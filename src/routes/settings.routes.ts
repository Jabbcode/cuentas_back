import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import * as settingsController from '../controllers/settings.controller.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get user profile
router.get('/profile', settingsController.getProfile);

// Update user profile (name, email)
router.patch('/profile', settingsController.updateProfile);

// Change password
router.post('/change-password', settingsController.changePassword);

// Get account statistics
router.get('/statistics', settingsController.getStatistics);

// Delete account (dangerous)
router.delete('/account', settingsController.deleteAccount);

export default router;
