import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { confirmMappingsSchema } from '../schemas/banking.schema.js';
import * as bankingService from '../services/banking.service.js';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

export async function getProviders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rawCountry = req.query['country'];
    const countryCode = typeof rawCountry === 'string' ? rawCountry.toUpperCase() : undefined;
    const result = await bankingService.getProviders(countryCode);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function initConnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await bankingService.initConnect(req.user!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleCallback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rawCode = req.query['code'];
    const rawState = req.query['state'];
    const code = typeof rawCode === 'string' ? rawCode : undefined;
    const state = typeof rawState === 'string' ? rawState : undefined;

    if (!code || !state) {
      res.status(400).json({ error: 'Missing code or state parameter' });
      return;
    }

    const { pendingAuthId } = await bankingService.handleCallback(code, state);
    res.redirect(`${FRONTEND_URL}/banking/map?pending=${pendingAuthId}`);
  } catch (error) {
    next(error);
  }
}

export async function getPendingAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const result = await bankingService.getPendingAccounts(id, req.user!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function confirmMappings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = confirmMappingsSchema.parse(req.body);
    const result = await bankingService.confirmMappings(data, req.user!.userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getConnections(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const connections = await bankingService.getConnections(req.user!.userId);
    res.json(connections);
  } catch (error) {
    next(error);
  }
}

export async function disconnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    await bankingService.disconnect(id, req.user!.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function triggerSync(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const result = await bankingService.triggerSync(id, req.user!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await bankingService.getStatus(req.user!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
