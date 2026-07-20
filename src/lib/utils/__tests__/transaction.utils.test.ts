import { describe, it, expect } from 'vitest';
import { buildTransactionWhereInput } from '../transaction.utils.js';

describe('buildTransactionWhereInput', () => {
  it('sin filtros: solo userId', () => {
    const where = buildTransactionWhereInput('user-1', {});
    expect(where).toEqual({ userId: 'user-1' });
  });

  it('con rango de fechas', () => {
    const where = buildTransactionWhereInput('user-1', {
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    });
    expect(where).toEqual({
      userId: 'user-1',
      date: { gte: new Date('2026-06-01'), lte: new Date('2026-06-30') },
    });
  });

  it('con categoryIds múltiples usa "in" e ignora categoryId', () => {
    const where = buildTransactionWhereInput('user-1', {
      categoryIds: ['cat-1', 'cat-2'],
      categoryId: 'cat-3',
    });
    expect(where).toEqual({ userId: 'user-1', categoryId: { in: ['cat-1', 'cat-2'] } });
  });

  it('con categoryId único (sin categoryIds)', () => {
    const where = buildTransactionWhereInput('user-1', { categoryId: 'cat-3' });
    expect(where).toEqual({ userId: 'user-1', categoryId: 'cat-3' });
  });

  it('con minAmount y maxAmount', () => {
    const where = buildTransactionWhereInput('user-1', { minAmount: 10, maxAmount: 100 });
    expect(where).toEqual({ userId: 'user-1', amount: { gte: 10, lte: 100 } });
  });

  it('con accountId y type', () => {
    const where = buildTransactionWhereInput('user-1', { accountId: 'acc-1', type: 'expense' });
    expect(where).toEqual({ userId: 'user-1', accountId: 'acc-1', type: 'expense' });
  });
});
