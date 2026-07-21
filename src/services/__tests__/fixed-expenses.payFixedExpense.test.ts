import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictError } from '../../lib/errors.js';

vi.mock('../transactions.service.js', () => ({
  createTransaction: vi.fn(),
}));

vi.mock('../credit-cards.service.js', () => ({
  payCreditCardStatement: vi.fn(),
}));

vi.mock('../../repositories/fixed-expense.repository.js', () => ({
  findByIdAndUser: vi.fn(),
}));

import { createTransaction } from '../transactions.service.js';
import { payCreditCardStatement } from '../credit-cards.service.js';
import * as fixedExpenseRepo from '../../repositories/fixed-expense.repository.js';
import { payFixedExpense } from '../fixed-expenses.service.js';

const mockedCreateTransaction = createTransaction as unknown as ReturnType<typeof vi.fn>;
const mockedPayCreditCardStatement = payCreditCardStatement as unknown as ReturnType<typeof vi.fn>;
const mockedFindByIdAndUser = fixedExpenseRepo.findByIdAndUser as unknown as ReturnType<
  typeof vi.fn
>;

function fakeFixedExpense() {
  return {
    id: 'fe-1',
    userId: 'user-1',
    name: 'Pago Tarjeta',
    amount: 100,
    type: 'expense',
    accountId: 'account-1',
    categoryId: 'category-1',
    creditCardAccountId: 'card-1',
    recurringDebtPaymentId: null,
  };
}

describe('payFixedExpense — catch de payCreditCardStatement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindByIdAndUser.mockResolvedValue(fakeFixedExpense());
    mockedCreateTransaction.mockResolvedValue({ id: 'tx-1' });
  });

  it('ConflictError no se relanza — el pago se considera exitoso', async () => {
    mockedPayCreditCardStatement.mockRejectedValueOnce(
      new ConflictError('El estado de cuenta ya está pagado')
    );

    await expect(payFixedExpense('fe-1', {}, 'user-1')).resolves.toEqual({ id: 'tx-1' });
    expect(mockedCreateTransaction).toHaveBeenCalledTimes(1);
  });

  it('Error genérico sí se relanza', async () => {
    mockedPayCreditCardStatement.mockRejectedValueOnce(new Error('boom'));

    await expect(payFixedExpense('fe-1', {}, 'user-1')).rejects.toThrow('boom');
  });

  it('ConflictError con un mensaje distinto tampoco se relanza (desacoplado del texto)', async () => {
    mockedPayCreditCardStatement.mockRejectedValueOnce(
      new ConflictError('mensaje totalmente diferente')
    );

    await expect(payFixedExpense('fe-1', {}, 'user-1')).resolves.toEqual({ id: 'tx-1' });
  });

  it('Error genérico cuyo mensaje contiene "ya está pagado" SÍ se relanza (ya no se confunde por texto)', async () => {
    mockedPayCreditCardStatement.mockRejectedValueOnce(
      new Error('ya está pagado, pero esto es un error real')
    );

    await expect(payFixedExpense('fe-1', {}, 'user-1')).rejects.toThrow('ya está pagado');
  });
});
