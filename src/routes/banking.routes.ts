import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import * as bankingController from '../controllers/banking.controller.js';

const router = Router();

// GET /api/banking/providers — public, no auth needed
router.get('/providers', bankingController.getProviders);

// GET /api/banking/connect — requires JWT
router.get('/connect', authMiddleware, bankingController.initConnect);

// GET /api/banking/callback — no auth (TrueLayer redirects here)
router.get('/callback', bankingController.handleCallback);

// GET /api/banking/status — requires JWT
router.get('/status', authMiddleware, bankingController.getStatus);

// GET /api/banking/connections — requires JWT
router.get('/connections', authMiddleware, bankingController.getConnections);

// GET /api/banking/pending/:id — requires JWT
router.get('/pending/:id', authMiddleware, bankingController.getPendingAccounts);

// POST /api/banking/connections/map — requires JWT
router.post('/connections/map', authMiddleware, bankingController.confirmMappings);

// POST /api/banking/connections/:id/sync — requires JWT
router.post('/connections/:id/sync', authMiddleware, bankingController.triggerSync);

// DELETE /api/banking/connections/:id — requires JWT
router.delete('/connections/:id', authMiddleware, bankingController.disconnect);

export default router;
