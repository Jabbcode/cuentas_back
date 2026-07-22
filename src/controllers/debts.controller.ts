import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { debtsService } from '../bootstrap.js';
import { createDebtSchema, updateDebtSchema, payDebtSchema } from '../schemas/debt.schema.js';

export async function createDebt(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const data = createDebtSchema.parse(req.body);
    const debt = await debtsService.createDebt(userId, data);
    res.status(201).json(debt);
  } catch (error: unknown) {
    next(error);
  }
}

export async function getDebts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const debts = await debtsService.getDebts(userId, status);
    res.json(debts);
  } catch (error: unknown) {
    next(error);
  }
}

export async function getDebtById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const debt = await debtsService.getDebtById(id, userId);
    res.json(debt);
  } catch (error: unknown) {
    next(error);
  }
}

export async function updateDebt(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const data = updateDebtSchema.parse(req.body);
    const debt = await debtsService.updateDebt(id, userId, data);
    res.json(debt);
  } catch (error: unknown) {
    next(error);
  }
}

export async function deleteDebt(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const result = await debtsService.deleteDebt(id, userId);
    res.json(result);
  } catch (error: unknown) {
    next(error);
  }
}

export async function payDebt(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const data = payDebtSchema.parse(req.body);
    const result = await debtsService.payDebt(id, userId, data);
    res.json(result);
  } catch (error: unknown) {
    next(error);
  }
}

export async function getDebtsSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const summary = await debtsService.getDebtsSummary(userId);
    res.json(summary);
  } catch (error: unknown) {
    next(error);
  }
}
