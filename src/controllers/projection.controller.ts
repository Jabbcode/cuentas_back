import { Response, NextFunction } from 'express';
import { getFinancialProjection } from '../services/projection.service.js';
import { AuthRequest } from '../types/index.js';

export async function getProjection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const raw = parseInt(req.query.days as string, 10);
    const days = isNaN(raw) ? 30 : Math.min(Math.max(raw, 1), 365);

    const projection = await getFinancialProjection(req.user!.userId, days);
    res.json(projection);
  } catch (error) {
    next(error);
  }
}
