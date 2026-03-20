import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export type AccountType = 'cash' | 'bank' | 'credit_card';
export type TransactionType = 'expense' | 'income';
