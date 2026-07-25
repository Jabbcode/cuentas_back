import type { Account, Transaction, CreditCardPayment } from '@prisma/client';

export interface CreditCardPeriod {
  startDate: Date;
  endDate: Date;
  balance: number;
  transactions: Transaction[];
}

export interface CreditCardStatement {
  account: Account;
  currentPeriod: CreditCardPeriod & {
    daysUntilCutoff: number;
  };
  closedPeriod: CreditCardPeriod & {
    isPaid: boolean;
    paymentDueDate: Date;
    daysUntilDue: number;
  };
  creditLimit: number;
  available: number;
  usagePercentage: number;
  alerts: {
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }[];
}

export interface CreditCardsSummary {
  totalToPay: number;
  upcomingPayments: {
    accountId: string;
    accountName: string;
    amount: number;
    dueDate: Date;
    daysUntilDue: number;
  }[];
  alerts: (CreditCardStatement['alerts'][number] & { accountId: string; accountName: string })[];
  cards: CreditCardStatement[];
}

export interface PayCreditCardStatementInput {
  amount: number;
  paymentAccountId: string;
  paymentDate?: string;
}

export interface CreditCardsService {
  getCreditCardStatement(accountId: string, userId: string): Promise<CreditCardStatement>;
  getCreditCardsSummary(userId: string): Promise<CreditCardsSummary>;
  payCreditCardStatement(
    accountId: string,
    userId: string,
    data: PayCreditCardStatementInput
  ): Promise<CreditCardPayment>;
}
