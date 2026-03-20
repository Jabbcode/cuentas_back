import { Response, NextFunction } from 'express';
import * as creditCardsService from '../services/credit-cards.service.js';
import { AuthRequest } from '../types/index.js';

export async function getStatement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.accountId as string;
    const statement = await creditCardsService.getCreditCardStatement(accountId, req.user!.userId);
    res.json(statement);
  } catch (error) {
    next(error);
  }
}

export async function getSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const summary = await creditCardsService.getCreditCardsSummary(req.user!.userId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

export async function payStatement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.accountId as string;
    const { amount, paymentAccountId, paymentDate } = req.body;

    const payment = await creditCardsService.payCreditCardStatement(accountId, req.user!.userId, {
      amount: parseFloat(amount),
      paymentAccountId,
      paymentDate,
    });

    res.json(payment);
  } catch (error) {
    next(error);
  }
}
