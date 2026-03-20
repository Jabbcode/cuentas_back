import { Response, NextFunction } from 'express';
import * as accountsService from '../services/accounts.service.js';
import { createAccountSchema, updateAccountSchema } from '../schemas/account.schema.js';
import { AuthRequest } from '../types/index.js';

export async function getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accounts = await accountsService.getAccounts(req.user!.userId);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
}

export async function getAccountById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const account = await accountsService.getAccountById(id, req.user!.userId);
    res.json(account);
  } catch (error) {
    if (error instanceof Error && error.message === 'Cuenta no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function createAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createAccountSchema.parse(req.body);
    const account = await accountsService.createAccount(data, req.user!.userId);
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
}

export async function updateAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const data = updateAccountSchema.parse(req.body);
    const account = await accountsService.updateAccount(id, data, req.user!.userId);
    res.json(account);
  } catch (error) {
    if (error instanceof Error && error.message === 'Cuenta no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await accountsService.deleteAccount(id, req.user!.userId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === 'Cuenta no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}
