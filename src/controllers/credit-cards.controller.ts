import { Response, NextFunction } from 'express';
import { creditCardsService } from '../bootstrap.js';
import { AuthRequest } from '../types/index.js';
import { statementQuerySchema, payStatementSchema } from '../schemas/credit-card.schema.js';

export async function getStatement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.accountId as string;
    const { months } = statementQuerySchema.parse(req.query);
    const statement = await creditCardsService.getCreditCardStatement(
      accountId,
      req.user!.userId,
      months
    );
    res.json(statement);
  } catch (error) {
    next(error);
  }
}

export async function getSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { months } = statementQuerySchema.parse(req.query);
    const summary = await creditCardsService.getCreditCardsSummary(req.user!.userId, months);
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

export async function payStatement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.accountId as string;
    const { amount, paymentAccountId, paymentDate } = payStatementSchema.parse(req.body);

    const payment = await creditCardsService.payCreditCardStatement(accountId, req.user!.userId, {
      amount,
      paymentAccountId,
      paymentDate,
    });

    res.json(payment);
  } catch (error) {
    next(error);
  }
}
