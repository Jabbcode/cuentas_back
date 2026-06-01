import { Router } from 'express';
import express from 'express';
import { sentryTunnel } from '../controllers/monitoring.controller.js';

const router = Router();

router.post('/tunnel', express.text({ type: '*/*', limit: '5mb' }), sentryTunnel);

export default router;
