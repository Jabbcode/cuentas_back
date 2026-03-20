import { Response, NextFunction } from 'express';
import * as transactionsService from '../services/transactions.service.js';
import { createTransactionSchema, updateTransactionSchema, transactionQuerySchema } from '../schemas/transaction.schema.js';
import { AuthRequest } from '../types/index.js';

export async function getTransactions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = transactionQuerySchema.parse(req.query);
    const result = await transactionsService.getTransactions(req.user!.userId, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getTransactionById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const transaction = await transactionsService.getTransactionById(id, req.user!.userId);
    res.json(transaction);
  } catch (error) {
    if (error instanceof Error && error.message === 'Transacción no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function createTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createTransactionSchema.parse(req.body);
    const transaction = await transactionsService.createTransaction(data, req.user!.userId);
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
}

export async function updateTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const data = updateTransactionSchema.parse(req.body);
    const transaction = await transactionsService.updateTransaction(id, data, req.user!.userId);
    res.json(transaction);
  } catch (error) {
    if (error instanceof Error && error.message === 'Transacción no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function deleteTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await transactionsService.deleteTransaction(id, req.user!.userId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === 'Transacción no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}
