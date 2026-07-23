import { prisma } from './lib/prisma.js';
import { AccountRepositoryImpl } from './repositories/account.repository.js';
import { UserRepositoryImpl } from './repositories/user.repository.js';
import { AccountsServiceImpl } from './services/accounts.service.js';
import { AuthServiceImpl } from './services/auth.service.js';
import { DebtRepositoryImpl } from './repositories/debt.repository.js';
import { RecurringDebtPaymentRepositoryImpl } from './repositories/recurring-debt-payment.repository.js';
import { DebtsServiceImpl } from './services/debts.service.js';
import { RecurringDebtPaymentsServiceImpl } from './services/recurring-debt-payments.service.js';
import { CategoryRepositoryImpl } from './repositories/category.repository.js';
import { NotificationRepositoryImpl } from './repositories/notification.repository.js';
import { CreditCardPaymentRepositoryImpl } from './repositories/credit-card-payment.repository.js';
import { CategoriesServiceImpl } from './services/categories.service.js';
import { NotificationsServiceImpl } from './services/notifications.service.js';
import { CreditCardsServiceImpl } from './services/credit-cards.service.js';

const accountRepository = new AccountRepositoryImpl(prisma);
export const accountsService = new AccountsServiceImpl(accountRepository, prisma);

const userRepository = new UserRepositoryImpl(prisma);
export const authService = new AuthServiceImpl(userRepository);

const debtRepository = new DebtRepositoryImpl(prisma);
const recurringDebtPaymentRepository = new RecurringDebtPaymentRepositoryImpl(prisma);

export const debtsService = new DebtsServiceImpl(
  debtRepository,
  accountsService,
  recurringDebtPaymentRepository,
  prisma
);
export const recurringDebtPaymentsService = new RecurringDebtPaymentsServiceImpl(
  recurringDebtPaymentRepository,
  debtRepository,
  accountsService,
  debtsService
);

const categoryRepository = new CategoryRepositoryImpl(prisma);
const notificationRepository = new NotificationRepositoryImpl(prisma);
const creditCardPaymentRepository = new CreditCardPaymentRepositoryImpl(prisma);

export const categoriesService = new CategoriesServiceImpl(categoryRepository);
export const notificationsService = new NotificationsServiceImpl(
  notificationRepository,
  userRepository,
  categoryRepository
);
export const creditCardsService = new CreditCardsServiceImpl(
  accountRepository,
  creditCardPaymentRepository,
  categoryRepository
);
