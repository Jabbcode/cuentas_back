import { prisma } from './lib/prisma.js';
import { AccountRepositoryImpl } from './repositories/account.repository.js';
import { UserRepositoryImpl } from './repositories/user.repository.js';
import { AccountsServiceImpl } from './services/accounts.service.js';
import { AuthServiceImpl } from './services/auth.service.js';
import { CategoryRepositoryImpl } from './repositories/category.repository.js';
import { TransactionRepositoryImpl } from './repositories/transaction.repository.js';
import { TransactionsServiceImpl } from './services/transactions.service.js';
import { DebtRepositoryImpl } from './repositories/debt.repository.js';
import { RecurringDebtPaymentRepositoryImpl } from './repositories/recurring-debt-payment.repository.js';
import { DebtsServiceImpl } from './services/debts.service.js';
import { RecurringDebtPaymentsServiceImpl } from './services/recurring-debt-payments.service.js';
import { NotificationRepositoryImpl } from './repositories/notification.repository.js';
import { CreditCardPaymentRepositoryImpl } from './repositories/credit-card-payment.repository.js';
import { CategoriesServiceImpl } from './services/categories.service.js';
import { NotificationsServiceImpl } from './services/notifications.service.js';
import { CreditCardsServiceImpl } from './services/credit-cards.service.js';
import { FixedExpenseRepositoryImpl } from './repositories/fixed-expense.repository.js';
import { DashboardServiceImpl } from './services/dashboard.service.js';
import { FixedExpensesServiceImpl } from './services/fixed-expenses.service.js';
import { SettingsServiceImpl } from './services/settings.service.js';
import { ReceiptsServiceImpl } from './services/receipts.service.js';

const accountRepository = new AccountRepositoryImpl(prisma);
export const accountsService = new AccountsServiceImpl(accountRepository, prisma);

const userRepository = new UserRepositoryImpl(prisma);
export const authService = new AuthServiceImpl(userRepository);

const categoryRepository = new CategoryRepositoryImpl(prisma);
const transactionRepository = new TransactionRepositoryImpl(prisma);

export const transactionsService = new TransactionsServiceImpl(
  transactionRepository,
  accountsService,
  categoryRepository,
  prisma
);

const debtRepository = new DebtRepositoryImpl(prisma);
const recurringDebtPaymentRepository = new RecurringDebtPaymentRepositoryImpl(prisma);

export const debtsService = new DebtsServiceImpl(
  debtRepository,
  accountsService,
  recurringDebtPaymentRepository,
  transactionsService,
  prisma
);
export const recurringDebtPaymentsService = new RecurringDebtPaymentsServiceImpl(
  recurringDebtPaymentRepository,
  debtRepository,
  accountsService,
  debtsService
);

const notificationRepository = new NotificationRepositoryImpl(prisma);
const creditCardPaymentRepository = new CreditCardPaymentRepositoryImpl(prisma);

export const categoriesService = new CategoriesServiceImpl(categoryRepository, transactionsService);
export const notificationsService = new NotificationsServiceImpl(
  notificationRepository,
  userRepository,
  categoryRepository,
  transactionsService
);
export const creditCardsService = new CreditCardsServiceImpl(
  accountRepository,
  creditCardPaymentRepository,
  categoryRepository,
  transactionsService
);

const fixedExpenseRepository = new FixedExpenseRepositoryImpl(prisma);

export const dashboardService = new DashboardServiceImpl(
  accountRepository,
  fixedExpenseRepository,
  categoryRepository,
  transactionsService
);
export const fixedExpensesService = new FixedExpensesServiceImpl(
  fixedExpenseRepository,
  accountRepository,
  categoryRepository,
  debtsService,
  creditCardsService,
  transactionsService,
  prisma
);
export const settingsService = new SettingsServiceImpl(
  userRepository,
  accountRepository,
  categoryRepository,
  fixedExpenseRepository,
  transactionsService
);
export const receiptsService = new ReceiptsServiceImpl(transactionsService);
