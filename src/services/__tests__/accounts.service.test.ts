import { describe, it, expect } from 'vitest';
import type { Account, Transfer, PrismaClient } from '@prisma/client';
import type { AccountRepository } from '../../repositories/account.repository.port.js';
import { AccountsServiceImpl } from '../accounts.service.js';

function fakeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-1',
    name: 'Cuenta Test',
    type: 'bank',
    balance: 100,
    initialBalance: 0,
    currency: 'EUR',
    color: null,
    userId: 'user-1',
    creditLimit: null,
    cutoffDay: null,
    paymentDueDay: null,
    paymentAccountId: null,
    createdAt: new Date(),
    ...overrides,
  } as unknown as Account;
}

function fakeTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: 'transfer-1',
    fromAccountId: 'account-1',
    toAccountId: 'account-2',
    amount: 10,
    note: null,
    userId: 'user-1',
    date: new Date(),
    ...overrides,
  } as unknown as Transfer;
}

function fakeAccountRepo(overrides: Partial<AccountRepository> = {}): AccountRepository {
  return {
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findCreditCardsByUser: async () => [],
    countByUser: async () => 0,
    create: async () => fakeAccount(),
    update: async () => fakeAccount(),
    updateBalance: async () => fakeAccount(),
    decrementBalance: async () => fakeAccount(),
    remove: async () => fakeAccount(),
    createTransfer: async () => ({
      ...fakeTransfer(),
      fromAccount: fakeAccount(),
      toAccount: fakeAccount(),
    }),
    findTransfersByAccount: async () => [],
    ...overrides,
  };
}

function fakePrisma(txOverrides: Record<string, unknown> = {}): PrismaClient {
  const txFake = {
    account: { update: async () => fakeAccount() },
    transfer: {
      create: async () => ({
        ...fakeTransfer(),
        fromAccount: fakeAccount(),
        toAccount: fakeAccount(),
      }),
    },
    ...txOverrides,
  };

  return {
    $transaction: async (cb: (tx: unknown) => unknown) => cb(txFake),
  } as unknown as PrismaClient;
}

describe('AccountsServiceImpl', () => {
  describe('getAccountById', () => {
    it('lanza NotFoundError si el repo devuelve null', async () => {
      const repo = fakeAccountRepo({ findByIdAndUser: async () => null });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(service.getAccountById('account-1', 'user-1')).rejects.toThrow(
        'Cuenta no encontrada'
      );
    });

    it('devuelve la cuenta si existe', async () => {
      const account = fakeAccount();
      const repo = fakeAccountRepo({ findByIdAndUser: async () => account });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(service.getAccountById('account-1', 'user-1')).resolves.toEqual(account);
    });
  });

  describe('createAccount / updateAccount / deleteAccount', () => {
    it('createAccount devuelve la cuenta creada', async () => {
      const created = fakeAccount({ name: 'Nueva' });
      const repo = fakeAccountRepo({ create: async () => created });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(
        service.createAccount(
          { name: 'Nueva', type: 'bank', balance: 0, currency: 'EUR' },
          'user-1'
        )
      ).resolves.toEqual(created);
    });

    it('updateAccount devuelve la cuenta actualizada', async () => {
      const existing = fakeAccount();
      const updated = fakeAccount({ name: 'Actualizada' });
      const repo = fakeAccountRepo({
        findByIdAndUser: async () => existing,
        update: async () => updated,
      });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(
        service.updateAccount('account-1', { name: 'Actualizada' }, 'user-1')
      ).resolves.toEqual(updated);
    });

    it('deleteAccount devuelve la cuenta eliminada', async () => {
      const existing = fakeAccount();
      const repo = fakeAccountRepo({
        findByIdAndUser: async () => existing,
        remove: async () => existing,
      });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(service.deleteAccount('account-1', 'user-1')).resolves.toEqual(existing);
    });
  });

  describe('transferFunds', () => {
    it('lanza ValidationError si fromAccountId === toAccountId', async () => {
      const repo = fakeAccountRepo();
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(
        service.transferFunds(
          { fromAccountId: 'account-1', toAccountId: 'account-1', amount: 10 },
          'user-1'
        )
      ).rejects.toThrow('Las cuentas de origen y destino deben ser diferentes');
    });

    it('lanza NotFoundError si alguna cuenta no existe', async () => {
      const repo = fakeAccountRepo({
        findByIdAndUser: async (id: string) => (id === 'account-1' ? fakeAccount() : null),
      });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(
        service.transferFunds(
          { fromAccountId: 'account-1', toAccountId: 'account-2', amount: 10 },
          'user-1'
        )
      ).rejects.toThrow('Cuenta destino no encontrada');
    });

    it('lanza ValidationError si el saldo es insuficiente', async () => {
      const repo = fakeAccountRepo({
        findByIdAndUser: async () => fakeAccount({ balance: 5 }),
      });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(
        service.transferFunds(
          { fromAccountId: 'account-1', toAccountId: 'account-2', amount: 10 },
          'user-1'
        )
      ).rejects.toThrow('Saldo insuficiente en la cuenta origen');
    });

    it('en éxito invoca $transaction y devuelve la transferencia', async () => {
      const repo = fakeAccountRepo({
        findByIdAndUser: async () => fakeAccount({ balance: 100 }),
      });
      const prisma = fakePrisma();
      const service = new AccountsServiceImpl(repo, prisma);

      const result = await service.transferFunds(
        { fromAccountId: 'account-1', toAccountId: 'account-2', amount: 10 },
        'user-1'
      );

      expect(result.id).toBe('transfer-1');
    });
  });

  describe('findAccountById (Fase 6 — null-returning, sin lanzar)', () => {
    it('devuelve null si el repo no encuentra la cuenta (a diferencia de getAccountById)', async () => {
      const repo = fakeAccountRepo({ findByIdAndUser: async () => null });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(service.findAccountById('account-1', 'user-1')).resolves.toBeNull();
    });

    it('devuelve la cuenta si existe', async () => {
      const account = fakeAccount();
      const repo = fakeAccountRepo({ findByIdAndUser: async () => account });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(service.findAccountById('account-1', 'user-1')).resolves.toEqual(account);
    });
  });

  describe('getCreditCards / getConfiguredCreditCards (Fase 6)', () => {
    it('getCreditCards delega en findCreditCardsByUser sin filtros extra', async () => {
      const cards = [fakeAccount({ id: 'card-1', type: 'credit_card' })];
      const findCreditCardsByUser = async () => cards;
      const repo = fakeAccountRepo({ findCreditCardsByUser });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(service.getCreditCards('user-1')).resolves.toEqual(cards);
    });

    it('getConfiguredCreditCards filtra por paymentAccountId/cutoffDay/paymentDueDay configurados', async () => {
      const calls: unknown[] = [];
      const repo = fakeAccountRepo({
        findCreditCardsByUser: async (userId, filters) => {
          calls.push({ userId, filters });
          return [];
        },
      });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await service.getConfiguredCreditCards('user-1');

      expect(calls).toEqual([
        {
          userId: 'user-1',
          filters: {
            paymentAccountId: { not: null },
            cutoffDay: { not: null },
            paymentDueDay: { not: null },
          },
        },
      ]);
    });
  });

  describe('countByUser (Fase 6)', () => {
    it('delega en accountRepo.countByUser', async () => {
      const repo = fakeAccountRepo({ countByUser: async () => 3 });
      const service = new AccountsServiceImpl(repo, fakePrisma());

      await expect(service.countByUser('user-1')).resolves.toBe(3);
    });
  });
});
