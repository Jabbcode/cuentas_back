import { Response, NextFunction } from 'express';
import * as fixedExpensesService from '../services/fixed-expenses.service.js';
import { createFixedExpenseSchema, updateFixedExpenseSchema, payFixedExpenseSchema } from '../schemas/fixed-expense.schema.js';
import { AuthRequest } from '../types/index.js';

export async function getFixedExpenses(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.active === 'true';
    const fixedExpenses = await fixedExpensesService.getFixedExpenses(req.user!.userId, activeOnly);
    res.json(fixedExpenses);
  } catch (error) {
    next(error);
  }
}

export async function getFixedExpenseById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const fixedExpense = await fixedExpensesService.getFixedExpenseById(id, req.user!.userId);
    res.json(fixedExpense);
  } catch (error) {
    if (error instanceof Error && error.message === 'Gasto fijo no encontrado') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function createFixedExpense(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createFixedExpenseSchema.parse(req.body);
    const fixedExpense = await fixedExpensesService.createFixedExpense(data, req.user!.userId);
    res.status(201).json(fixedExpense);
  } catch (error) {
    next(error);
  }
}

export async function updateFixedExpense(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const data = updateFixedExpenseSchema.parse(req.body);
    const fixedExpense = await fixedExpensesService.updateFixedExpense(id, data, req.user!.userId);
    res.json(fixedExpense);
  } catch (error) {
    if (error instanceof Error && error.message === 'Gasto fijo no encontrado') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function deleteFixedExpense(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await fixedExpensesService.deleteFixedExpense(id, req.user!.userId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === 'Gasto fijo no encontrado') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function payFixedExpense(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const data = payFixedExpenseSchema.parse(req.body);
    const transaction = await fixedExpensesService.payFixedExpense(id, data, req.user!.userId);
    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof Error && error.message === 'Gasto fijo no encontrado') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function getFixedExpensesSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const summary = await fixedExpensesService.getFixedExpensesSummary(req.user!.userId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
}
