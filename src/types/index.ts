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

// Banking / TrueLayer types
export interface TrueLayerAccount {
  account_id: string;
  account_type: string;
  display_name: string;
  currency: string;
  account_number?: {
    iban?: string;
    number?: string;
    sort_code?: string;
  };
  provider?: {
    display_name: string;
    provider_id: string;
  };
  balance?: number;
}

export interface TrueLayerProvider {
  provider_id: string;
  display_name: string;
  logo_uri: string;
  country: string;
  divisions: string[];
}

export interface TrueLayerTransaction {
  transaction_id: string;
  timestamp: string;
  description: string;
  amount: number;
  currency: string;
  transaction_type: string;
  transaction_category?: string;
  merchant_name?: string;
  running_balance?: {
    amount: number;
    currency: string;
  };
}

export interface ExchangedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface SyncResult {
  connectionId: string;
  synced: number;
  error?: string;
}

export interface BankConnectionStatus {
  id: string;
  bankName: string;
  accountName: string;
  lastSyncedAt: Date | null;
  isActive: boolean;
  accountId: string;
}
