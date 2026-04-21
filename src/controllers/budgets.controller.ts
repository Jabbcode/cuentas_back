import { Response, NextFunction } from 'express';
import * as budgetsService from '../services/budgets.service.js';
import { createBudgetSchema, updateBudgetSchema } from '../schemas/budget.schema.js';
import { AuthRequest } from '../types/index.js';

export async function getBudgets(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
    const budgets = await budgetsService.getBudgets(req.user!.userId, month, year);
    res.json(budgets);
  } catch (error) {
    next(error);
  }
}

export async function createBudget(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createBudgetSchema.parse(req.body);
    const budget = await budgetsService.createBudget(data, req.user!.userId);
    res.status(201).json(budget);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Ya existe')) {
      res.status(409).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function updateBudget(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const data = updateBudgetSchema.parse(req.body);
    const budget = await budgetsService.updateBudget(id, data, req.user!.userId);
    res.json(budget);
  } catch (error) {
    if (error instanceof Error && error.message === 'Presupuesto no encontrado') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function deleteBudget(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await budgetsService.deleteBudget(id, req.user!.userId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === 'Presupuesto no encontrado') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}
