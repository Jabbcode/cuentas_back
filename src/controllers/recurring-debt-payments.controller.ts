import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { recurringDebtPaymentsService } from '../bootstrap.js';
import {
  createRecurringDebtPaymentSchema,
  updateRecurringDebtPaymentSchema,
} from '../schemas/recurring-debt-payment.schema.js';

export async function createRecurringDebtPayment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.userId;
    const data = createRecurringDebtPaymentSchema.parse(req.body);
    const recurringPayment = await recurringDebtPaymentsService.createRecurringDebtPayment(
      userId,
      data
    );
    res.status(201).json(recurringPayment);
  } catch (error: unknown) {
    next(error);
  }
}

export async function getRecurringDebtPayments(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.userId;
    const debtId = typeof req.query.debtId === 'string' ? req.query.debtId : undefined;
    const recurringPayments = await recurringDebtPaymentsService.getRecurringDebtPayments(
      userId,
      debtId
    );
    res.json(recurringPayments);
  } catch (error: unknown) {
    next(error);
  }
}

export async function getRecurringDebtPaymentById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const recurringPayment = await recurringDebtPaymentsService.getRecurringDebtPaymentById(
      id,
      userId
    );
    res.json(recurringPayment);
  } catch (error: unknown) {
    next(error);
  }
}

export async function updateRecurringDebtPayment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const data = updateRecurringDebtPaymentSchema.parse(req.body);
    const recurringPayment = await recurringDebtPaymentsService.updateRecurringDebtPayment(
      id,
      userId,
      data
    );
    res.json(recurringPayment);
  } catch (error: unknown) {
    next(error);
  }
}

export async function deleteRecurringDebtPayment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const result = await recurringDebtPaymentsService.deleteRecurringDebtPayment(id, userId);
    res.json(result);
  } catch (error: unknown) {
    next(error);
  }
}

export async function processPendingPayments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await recurringDebtPaymentsService.processPendingRecurringPayments();
    res.json(result);
  } catch (error: unknown) {
    next(error);
  }
}
