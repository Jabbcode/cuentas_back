import type { Account, Transaction, CreditCardPayment } from '@prisma/client';

export interface CreditCardPeriod {
  startDate: Date;
  endDate: Date;
  balance: number;
  transactions: Transaction[];
}

export interface CreditCardOverduePeriod {
  startDate: Date;
  endDate: Date;
  /**
   * Clave estable del período en formato YYYY-MM-DD (componentes locales, no UTC).
   * Es lo que el cliente debe reenviar como `periodStart` al pagar — `startDate`
   * se serializa a ISO en UTC y puede desplazarse un día en husos horarios
   * adelantados a UTC, así que no sirve como clave de ida y vuelta.
   */
  periodKey: string;
  balance: number;
  transactionCount: number;
  paymentDueDate: Date;
  daysOverdue: number;
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
  /** Períodos cerrados anteriores al closedPeriod, sin pagar, dentro de la ventana `monthsBack`. Ordenados ascendente (más atrasado primero). */
  overduePeriods: CreditCardOverduePeriod[];
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
  /** Fecha de inicio (YYYY-MM-DD) del período atrasado a pagar. Sin ella, se paga el closedPeriod (comportamiento actual). */
  periodStart?: string;
}

export interface CreditCardsService {
  getCreditCardStatement(
    accountId: string,
    userId: string,
    monthsBack?: number
  ): Promise<CreditCardStatement>;
  getCreditCardsSummary(userId: string, monthsBack?: number): Promise<CreditCardsSummary>;
  payCreditCardStatement(
    accountId: string,
    userId: string,
    data: PayCreditCardStatementInput
  ): Promise<CreditCardPayment>;
}
