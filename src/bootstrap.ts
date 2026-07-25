import { prisma } from './lib/prisma.js';
import { AccountRepositoryImpl } from './repositories/account.repository.js';
import { UserRepositoryImpl } from './repositories/user.repository.js';
import { AccountsServiceImpl } from './services/accounts.service.js';
import { AuthServiceImpl } from './services/auth.service.js';
import { UsersServiceImpl } from './services/users.service.js';
import { CategoryRepositoryImpl } from './repositories/category.repository.js';
import { TransactionRepositoryImpl } from './repositories/transaction.repository.js';
import { TransactionsServiceImpl } from './services/transactions.service.js';
import { CategoriesServiceImpl } from './services/categories.service.js';
import { DebtRepositoryImpl } from './repositories/debt.repository.js';
import { RecurringDebtPaymentRepositoryImpl } from './repositories/recurring-debt-payment.repository.js';
import { FixedExpenseRepositoryImpl } from './repositories/fixed-expense.repository.js';
import { DebtsServiceImpl } from './services/debts.service.js';
import { RecurringDebtPaymentsServiceImpl } from './services/recurring-debt-payments.service.js';
import { NotificationRepositoryImpl } from './repositories/notification.repository.js';
import { CreditCardPaymentRepositoryImpl } from './repositories/credit-card-payment.repository.js';
import { CreditCardsServiceImpl } from './services/credit-cards.service.js';
import { FixedExpensesServiceImpl } from './services/fixed-expenses.service.js';
import { DashboardServiceImpl } from './services/dashboard.service.js';
import { ProjectionServiceImpl } from './services/projection.service.js';
import { NotificationsServiceImpl } from './services/notifications.service.js';
import { SettingsServiceImpl } from './services/settings.service.js';
import { ReceiptsServiceImpl } from './services/receipts.service.js';

const accountRepository = new AccountRepositoryImpl(prisma);
export const accountsService = new AccountsServiceImpl(accountRepository, prisma);

const userRepository = new UserRepositoryImpl(prisma);
export const authService = new AuthServiceImpl(userRepository);
export const usersService = new UsersServiceImpl(userRepository);

const categoryRepository = new CategoryRepositoryImpl(prisma);
const transactionRepository = new TransactionRepositoryImpl(prisma);

export const transactionsService = new TransactionsServiceImpl(
  transactionRepository,
  accountsService,
  categoryRepository,
  prisma
);
export const categoriesService = new CategoriesServiceImpl(categoryRepository, transactionsService);

const debtRepository = new DebtRepositoryImpl(prisma);
const recurringDebtPaymentRepository = new RecurringDebtPaymentRepositoryImpl(prisma);
const fixedExpenseRepository = new FixedExpenseRepositoryImpl(prisma);

export const debtsService = new DebtsServiceImpl(
  debtRepository,
  accountsService,
  recurringDebtPaymentRepository,
  transactionsService,
  fixedExpenseRepository,
  prisma
);
export const recurringDebtPaymentsService = new RecurringDebtPaymentsServiceImpl(
  recurringDebtPaymentRepository,
  accountsService,
  debtsService
);

const notificationRepository = new NotificationRepositoryImpl(prisma);
const creditCardPaymentRepository = new CreditCardPaymentRepositoryImpl(prisma);

export const creditCardsService = new CreditCardsServiceImpl(
  accountsService,
  creditCardPaymentRepository,
  categoriesService,
  transactionsService,
  fixedExpenseRepository
);
export const fixedExpensesService = new FixedExpensesServiceImpl(
  fixedExpenseRepository,
  accountsService,
  categoriesService,
  debtsService,
  creditCardsService,
  transactionsService,
  recurringDebtPaymentsService,
  prisma
);
export const dashboardService = new DashboardServiceImpl(
  accountsService,
  fixedExpensesService,
  categoriesService,
  transactionsService
);
export const projectionService = new ProjectionServiceImpl(fixedExpensesService);
export const notificationsService = new NotificationsServiceImpl(
  notificationRepository,
  usersService,
  categoriesService,
  transactionsService
);
export const settingsService = new SettingsServiceImpl(
  usersService,
  accountsService,
  categoriesService,
  fixedExpensesService,
  debtsService,
  transactionsService
);
export const receiptsService = new ReceiptsServiceImpl(transactionsService);
