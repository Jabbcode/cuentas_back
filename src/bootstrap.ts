import { prisma } from './lib/prisma.js';
import { AccountRepositoryImpl } from './repositories/repositoryImpl/account.repository.js';
import { UserRepositoryImpl } from './repositories/repositoryImpl/user.repository.js';
import { AccountsServiceImpl } from './services/serviceImpl/accounts.service.js';
import { AuthServiceImpl } from './services/serviceImpl/auth.service.js';
import { UsersServiceImpl } from './services/serviceImpl/users.service.js';
import { CategoryRepositoryImpl } from './repositories/repositoryImpl/category.repository.js';
import { TransactionRepositoryImpl } from './repositories/repositoryImpl/transaction.repository.js';
import { TransactionsServiceImpl } from './services/serviceImpl/transactions.service.js';
import { CategoriesServiceImpl } from './services/serviceImpl/categories.service.js';
import { DebtRepositoryImpl } from './repositories/repositoryImpl/debt.repository.js';
import { RecurringDebtPaymentRepositoryImpl } from './repositories/repositoryImpl/recurring-debt-payment.repository.js';
import { FixedExpenseRepositoryImpl } from './repositories/repositoryImpl/fixed-expense.repository.js';
import { DebtsServiceImpl } from './services/serviceImpl/debts.service.js';
import { RecurringDebtPaymentsServiceImpl } from './services/serviceImpl/recurring-debt-payments.service.js';
import { NotificationRepositoryImpl } from './repositories/repositoryImpl/notification.repository.js';
import { CreditCardPaymentRepositoryImpl } from './repositories/repositoryImpl/credit-card-payment.repository.js';
import { CreditCardsServiceImpl } from './services/serviceImpl/credit-cards.service.js';
import { FixedExpensesServiceImpl } from './services/serviceImpl/fixed-expenses.service.js';
import { DashboardServiceImpl } from './services/serviceImpl/dashboard.service.js';
import { ProjectionServiceImpl } from './services/serviceImpl/projection.service.js';
import { NotificationsServiceImpl } from './services/serviceImpl/notifications.service.js';
import { SettingsServiceImpl } from './services/serviceImpl/settings.service.js';
import { ReceiptsServiceImpl } from './services/serviceImpl/receipts.service.js';

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
