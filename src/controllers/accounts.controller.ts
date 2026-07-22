import { Response, NextFunction } from 'express';
import { accountsService } from '../bootstrap.js';
import {
  createAccountSchema,
  updateAccountSchema,
  transferSchema,
} from '../schemas/account.schema.js';
import { AuthRequest } from '../types/index.js';
import { SHARED_MESSAGES } from '../lib/constants/shared.constants.js';
import { ACCOUNT_MESSAGES } from '../lib/constants/account.constants.js';

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
    if (error instanceof Error && error.message === SHARED_MESSAGES.ACCOUNT_NOT_FOUND) {
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
    if (error instanceof Error && error.message === SHARED_MESSAGES.ACCOUNT_NOT_FOUND) {
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
    if (error instanceof Error && error.message === SHARED_MESSAGES.ACCOUNT_NOT_FOUND) {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function transferFunds(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = transferSchema.parse(req.body);
    const transfer = await accountsService.transferFunds(data, req.user!.userId);
    res.status(201).json(transfer);
  } catch (error) {
    if (error instanceof Error) {
      const clientErrors: string[] = [
        ACCOUNT_MESSAGES.SAME_ORIGIN_DESTINATION,
        ACCOUNT_MESSAGES.ORIGIN_NOT_FOUND,
        ACCOUNT_MESSAGES.DESTINATION_NOT_FOUND,
        ACCOUNT_MESSAGES.INSUFFICIENT_BALANCE_ORIGIN,
      ];
      if (clientErrors.includes(error.message)) {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    next(error);
  }
}

export async function getTransfersByAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const transfers = await accountsService.getTransfersByAccount(id, req.user!.userId);
    res.json(transfers);
  } catch (error) {
    if (error instanceof Error && error.message === SHARED_MESSAGES.ACCOUNT_NOT_FOUND) {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}
