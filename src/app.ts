import express from 'express';
import cors from 'cors';
import { errorMiddleware } from './middlewares/error.middleware.js';

import authRoutes from './routes/auth.routes.js';
import accountsRoutes from './routes/accounts.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import transactionsRoutes from './routes/transactions.routes.js';
import fixedExpensesRoutes from './routes/fixed-expenses.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import creditCardsRoutes from './routes/credit-cards.routes.js';
import debtsRoutes from './routes/debts.routes.js';
import recurringDebtPaymentsRoutes from './routes/recurring-debt-payments.routes.js';
import receiptsRoutes from './routes/receipts.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import budgetsRoutes from './routes/budgets.routes.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/fixed-expenses', fixedExpensesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/credit-cards', creditCardsRoutes);
app.use('/api/debts', debtsRoutes);
app.use('/api/recurring-debt-payments', recurringDebtPaymentsRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/budgets', budgetsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorMiddleware);

export default app;
