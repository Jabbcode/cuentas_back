import { Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboard.service.js';
import * as projectionService from '../services/projection.service.js';
import { AuthRequest } from '../types/index.js';

export async function getSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const summary = await dashboardService.getSummary(req.user!.userId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

export async function getByCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const type = (req.query.type as 'expense' | 'income') || 'expense';
    const data = await dashboardService.getByCategory(req.user!.userId, type);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function getMonthlyTrend(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const months = parseInt(req.query.months as string) || 6;
    const data = await dashboardService.getMonthlyTrend(req.user!.userId, months);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function getFixedVsVariable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await dashboardService.getFixedVsVariable(req.user!.userId);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function getNextMonthProjection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projection = await projectionService.getNextMonthProjection(req.user!.userId);
    res.json(projection);
  } catch (error) {
    next(error);
  }
}
