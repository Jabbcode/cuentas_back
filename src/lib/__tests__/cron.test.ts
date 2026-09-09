import { describe, it, expect, vi, beforeEach } from 'vitest';

type CronCallback = () => Promise<void>;

const mockedSchedule = vi.hoisted(() => vi.fn());
vi.mock('node-cron', () => ({ default: { schedule: mockedSchedule } }));

const mockedAutoGenerate = vi.hoisted(() => vi.fn());
const mockedCreateNotification = vi.hoisted(() => vi.fn());
const mockedGetAllUsersForSummaries = vi.hoisted(() => vi.fn());
const mockedBuildMonthlySummariesBatch = vi.hoisted(() => vi.fn());
vi.mock('../../bootstrap.js', () => ({
  fixedExpensesService: { autoGenerateFixedExpenseTransactions: mockedAutoGenerate },
  notificationsService: {
    createNotification: mockedCreateNotification,
    buildMonthlySummariesBatch: mockedBuildMonthlySummariesBatch,
  },
  usersService: { getAllUsersForSummaries: mockedGetAllUsersForSummaries },
}));

const mockedDebtFindMany = vi.hoisted(() => vi.fn());
const mockedNotificationFindFirst = vi.hoisted(() => vi.fn());
vi.mock('../prisma.js', () => ({
  prisma: {
    debt: { findMany: mockedDebtFindMany },
    notification: { findFirst: mockedNotificationFindFirst },
  },
}));

const mockedSendMonthlySummaryEmail = vi.hoisted(() => vi.fn());
vi.mock('../email/index.js', () => ({ sendMonthlySummaryEmail: mockedSendMonthlySummaryEmail }));

import { startCronJobs } from '../cron.js';

function scheduledCallback(cronExpr: string): CronCallback {
  const call = mockedSchedule.mock.calls.find((c) => c[0] === cronExpr);
  if (!call) throw new Error(`no se registró un job con expresión "${cronExpr}"`);
  return call[1] as CronCallback;
}

describe('startCronJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startCronJobs();
  });

  it('registra los 3 jobs esperados', () => {
    expect(mockedSchedule).toHaveBeenCalledTimes(3);
    expect(mockedSchedule.mock.calls.map((c) => c[0])).toEqual([
      '0 7 * * *',
      '0 9 * * *',
      '0 8 1 * *',
    ]);
  });

  describe('job de auto-generación de gastos fijos (0 7 * * *)', () => {
    it('crea una notificación de éxito por cada usuario en createdByUser', async () => {
      mockedAutoGenerate.mockResolvedValue({ createdByUser: { 'user-1': 2 }, failedByUser: {} });

      await scheduledCallback('0 7 * * *')();

      expect(mockedCreateNotification).toHaveBeenCalledWith(
        'user-1',
        'auto_generated',
        expect.any(String),
        expect.stringContaining('2 transacciónes automáticas'),
        { created: 2 }
      );
    });

    it('crea una notificación de fallo por cada usuario en failedByUser', async () => {
      mockedAutoGenerate.mockResolvedValue({
        createdByUser: {},
        failedByUser: { 'user-1': [{ fixedExpenseName: 'Renta', message: 'límite excedido' }] },
      });

      await scheduledCallback('0 7 * * *')();

      expect(mockedCreateNotification).toHaveBeenCalledWith(
        'user-1',
        'auto_generate_failed',
        expect.any(String),
        expect.stringContaining('Renta'),
        expect.objectContaining({ failures: expect.any(Array) })
      );
    });

    it('si autoGenerateFixedExpenseTransactions lanza, el error se traga (no rompe el cron)', async () => {
      mockedAutoGenerate.mockRejectedValue(new Error('boom'));

      await expect(scheduledCallback('0 7 * * *')()).resolves.toBeUndefined();
    });
  });

  describe('job de deudas próximas a vencer (0 9 * * *)', () => {
    it('sin deudas próximas: no crea notificaciones', async () => {
      mockedDebtFindMany.mockResolvedValue([]);

      await scheduledCallback('0 9 * * *')();

      expect(mockedCreateNotification).not.toHaveBeenCalled();
    });

    it('usuario con notificationPreferences.debtDue=false: se omite', async () => {
      mockedDebtFindMany.mockResolvedValue([
        {
          id: 'debt-1',
          userId: 'user-1',
          creditor: 'Banco X',
          remainingAmount: 100,
          dueDate: new Date(),
          user: { id: 'user-1', notificationPreferences: { debtDue: false } },
        },
      ]);

      await scheduledCallback('0 9 * * *')();

      expect(mockedCreateNotification).not.toHaveBeenCalled();
    });

    it('ya existe una notificación hoy para esa deuda: no duplica', async () => {
      mockedDebtFindMany.mockResolvedValue([
        {
          id: 'debt-1',
          userId: 'user-1',
          creditor: 'Banco X',
          remainingAmount: 100,
          dueDate: new Date(),
          user: { id: 'user-1', notificationPreferences: { debtDue: true } },
        },
      ]);
      mockedNotificationFindFirst.mockResolvedValue({ id: 'notif-existing' });

      await scheduledCallback('0 9 * * *')();

      expect(mockedCreateNotification).not.toHaveBeenCalled();
    });

    it('deuda elegible sin notificación previa: crea la notificación de aviso', async () => {
      mockedDebtFindMany.mockResolvedValue([
        {
          id: 'debt-1',
          userId: 'user-1',
          creditor: 'Banco X',
          remainingAmount: 250.5,
          dueDate: new Date('2026-09-10'),
          user: { id: 'user-1', notificationPreferences: { debtDue: true } },
        },
      ]);
      mockedNotificationFindFirst.mockResolvedValue(null);

      await scheduledCallback('0 9 * * *')();

      expect(mockedCreateNotification).toHaveBeenCalledWith(
        'user-1',
        'debt_due',
        expect.stringContaining('Banco X'),
        expect.stringContaining('250.50'),
        expect.objectContaining({ debtId: 'debt-1' })
      );
    });

    it('createNotification lanza para una deuda: se loguea y no rompe el resto del job', async () => {
      mockedDebtFindMany.mockResolvedValue([
        {
          id: 'debt-1',
          userId: 'user-1',
          creditor: 'Banco X',
          remainingAmount: 100,
          dueDate: new Date(),
          user: { id: 'user-1', notificationPreferences: { debtDue: true } },
        },
      ]);
      mockedNotificationFindFirst.mockResolvedValue(null);
      mockedCreateNotification.mockRejectedValue(new Error('boom'));

      await expect(scheduledCallback('0 9 * * *')()).resolves.toBeUndefined();
    });

    it('si prisma.debt.findMany lanza, el error se traga', async () => {
      mockedDebtFindMany.mockRejectedValue(new Error('db down'));

      await expect(scheduledCallback('0 9 * * *')()).resolves.toBeUndefined();
    });
  });

  describe('job de resumen mensual por email (0 8 1 * *)', () => {
    it('sin usuarios elegibles (monthlyEmail=false): no envía ningún email', async () => {
      mockedGetAllUsersForSummaries.mockResolvedValue([
        {
          id: 'user-1',
          email: 'a@x.com',
          name: 'A',
          notificationPreferences: { monthlyEmail: false },
        },
      ]);

      await scheduledCallback('0 8 1 * *')();

      expect(mockedBuildMonthlySummariesBatch).not.toHaveBeenCalled();
      expect(mockedSendMonthlySummaryEmail).not.toHaveBeenCalled();
    });

    it('usuario elegible: arma el batch y envía su resumen', async () => {
      mockedGetAllUsersForSummaries.mockResolvedValue([
        {
          id: 'user-1',
          email: 'a@x.com',
          name: 'A',
          notificationPreferences: { monthlyEmail: true },
        },
      ]);
      mockedBuildMonthlySummariesBatch.mockResolvedValue(
        new Map([['user-1', { totalExpenses: 10, totalIncome: 20, categoryBreakdown: [] }]])
      );

      await scheduledCallback('0 8 1 * *')();

      expect(mockedBuildMonthlySummariesBatch).toHaveBeenCalledWith(
        ['user-1'],
        expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) })
      );
      expect(mockedSendMonthlySummaryEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@x.com',
          userName: 'A',
          totalExpenses: 10,
          totalIncome: 20,
        })
      );
    });

    it('sendMonthlySummaryEmail lanza para un usuario: se loguea y no rompe el resto', async () => {
      mockedGetAllUsersForSummaries.mockResolvedValue([
        {
          id: 'user-1',
          email: 'a@x.com',
          name: 'A',
          notificationPreferences: { monthlyEmail: true },
        },
      ]);
      mockedBuildMonthlySummariesBatch.mockResolvedValue(
        new Map([['user-1', { totalExpenses: 0, totalIncome: 0, categoryBreakdown: [] }]])
      );
      mockedSendMonthlySummaryEmail.mockRejectedValue(new Error('resend down'));

      await expect(scheduledCallback('0 8 1 * *')()).resolves.toBeUndefined();
    });

    it('si getAllUsersForSummaries lanza, el error se traga', async () => {
      mockedGetAllUsersForSummaries.mockRejectedValue(new Error('db down'));

      await expect(scheduledCallback('0 8 1 * *')()).resolves.toBeUndefined();
    });
  });
});
