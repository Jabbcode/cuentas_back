import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationError, AppError } from '../../lib/errors.js';
import type { TransactionsService, TxWithAccountCategory } from '../transactions.service.port.js';

const { mockAnthropicCreate, mockTesseractRecognize } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
  mockTesseractRecognize: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockAnthropicCreate } };
  }),
}));

vi.mock('tesseract.js', () => ({
  default: { recognize: mockTesseractRecognize },
}));

import { ReceiptsServiceImpl } from '../receipts.service.js';

function fakeTx(overrides: Partial<TxWithAccountCategory> = {}): TxWithAccountCategory {
  return {
    id: 'tx-1',
    amount: 25.5,
    description: 'Compra super',
    date: new Date('2026-07-20T00:00:00.000Z'),
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    account: { id: 'account-1', name: 'Cuenta Test' },
    category: { id: 'category-1', name: 'Alimentación' },
    ...overrides,
  } as unknown as TxWithAccountCategory;
}

function fakeTransactionsService(
  overrides: Partial<TransactionsService> = {}
): TransactionsService {
  return {
    getTransactions: async () => {
      throw new Error('not used in these tests');
    },
    getTransactionById: async () => {
      throw new Error('not used in these tests');
    },
    createTransaction: async () => {
      throw new Error('not used in these tests');
    },
    updateTransaction: async () => {
      throw new Error('not used in these tests');
    },
    deleteTransaction: async () => {
      throw new Error('not used in these tests');
    },
    getTransactionSummary: async () => [],
    getReceiptItems: async () => [],
    countByCategory: async () => 0,
    findMonthlyCategoryExpenses: async () => [],
    findCardStatementTransactions: async () => [],
    findFixedExpensePaymentInMonth: async () => null,
    resyncTransactionsForFixedExpense: async () => ({ count: 0 }),
    getMonthlyTotalByType: async () => ({ _sum: { amount: null } }),
    getVariableExpenseTotal: async () => ({ _sum: { amount: null } }),
    getCategoryBreakdown: async () => [],
    findTransactionsSince: async () => [],
    getTopExpenseCategories: async () => [],
    getUserTotalsByType: async () => [],
    getExpensesByUserAndCategory: async () => [],
    countByUser: async () => 0,
    getFirstTransactionDate: async () => null,
    findByImageHash: async () => null,
    findSimilarByAmountAndDate: async () => [],
    ...overrides,
  };
}

function claudeResponse(data: Record<string, unknown>) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

const VALID_SCANNED_DATA = {
  amount: 25.5,
  description: 'Compra super',
  date: '2026-07-20',
  suggestedCategory: 'Alimentación',
  confidence: 'high',
  items: [],
};

const LONG_OCR_TEXT = 'TICKET DE COMPRA SUPERMERCADO TOTAL 25.50 EUR FECHA 20/07/2026';

describe('ReceiptsServiceImpl.scanReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('duplicado exacto: no llama a OCR ni a Claude', async () => {
    const service = new ReceiptsServiceImpl(
      fakeTransactionsService({ findByImageHash: async () => fakeTx() })
    );

    const result = await service.scanReceipt(Buffer.from('img'), 'user-1');

    expect(result.duplicate).toBe(true);
    expect(result.matchType).toBe('exact');
    expect(result.existingTransaction?.id).toBe('tx-1');
    expect(mockTesseractRecognize).not.toHaveBeenCalled();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('fallo de OCR: propaga AppError (INTEGRATION_ERROR)', async () => {
    mockTesseractRecognize.mockRejectedValue(new Error('tesseract crashed'));
    const service = new ReceiptsServiceImpl(fakeTransactionsService());

    await expect(service.scanReceipt(Buffer.from('img'), 'user-1')).rejects.toThrow(AppError);
    await expect(service.scanReceipt(Buffer.from('img'), 'user-1')).rejects.toThrow(
      'Error al extraer texto de la imagen'
    );
  });

  it('texto ilegible: lanza ValidationError sin llamar a Claude', async () => {
    mockTesseractRecognize.mockResolvedValue({ data: { text: 'ab' } });
    const service = new ReceiptsServiceImpl(fakeTransactionsService());

    await expect(service.scanReceipt(Buffer.from('img'), 'user-1')).rejects.toThrow(
      ValidationError
    );
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('fallo de la IA (Claude): propaga AppError (INTEGRATION_ERROR)', async () => {
    mockTesseractRecognize.mockResolvedValue({ data: { text: LONG_OCR_TEXT } });
    mockAnthropicCreate.mockRejectedValue(new Error('claude timeout'));
    const service = new ReceiptsServiceImpl(fakeTransactionsService());

    await expect(service.scanReceipt(Buffer.from('img'), 'user-1')).rejects.toThrow(AppError);
    await expect(service.scanReceipt(Buffer.from('img'), 'user-1')).rejects.toThrow(
      'Error al procesar la factura con IA'
    );
  });

  it('sin duplicado: devuelve scannedData', async () => {
    mockTesseractRecognize.mockResolvedValue({ data: { text: LONG_OCR_TEXT } });
    mockAnthropicCreate.mockResolvedValue(claudeResponse(VALID_SCANNED_DATA));
    const service = new ReceiptsServiceImpl(
      fakeTransactionsService({ findSimilarByAmountAndDate: async () => [] })
    );

    const result = await service.scanReceipt(Buffer.from('img'), 'user-1');

    expect(result.duplicate).toBe(false);
    expect(result.matchType).toBe('none');
    expect(result.scannedData?.amount).toBe(25.5);
  });

  it('duplicado similar: devuelve la transacción existente + scannedData', async () => {
    mockTesseractRecognize.mockResolvedValue({ data: { text: LONG_OCR_TEXT } });
    mockAnthropicCreate.mockResolvedValue(
      claudeResponse({ ...VALID_SCANNED_DATA, description: '' })
    );
    const service = new ReceiptsServiceImpl(
      fakeTransactionsService({ findSimilarByAmountAndDate: async () => [fakeTx()] })
    );

    const result = await service.scanReceipt(Buffer.from('img'), 'user-1');

    expect(result.duplicate).toBe(true);
    expect(result.matchType).toBe('similar');
    expect(result.existingTransaction?.id).toBe('tx-1');
    expect(result.scannedData).toBeDefined();
  });
});

describe('ReceiptsServiceImpl.ocrOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('éxito: devuelve el texto extraído', async () => {
    mockTesseractRecognize.mockResolvedValue({ data: { text: LONG_OCR_TEXT } });
    const service = new ReceiptsServiceImpl(fakeTransactionsService());

    await expect(service.ocrOnly(Buffer.from('img'))).resolves.toEqual({
      rawText: LONG_OCR_TEXT,
    });
  });

  it('texto ilegible: lanza ValidationError', async () => {
    mockTesseractRecognize.mockResolvedValue({ data: { text: 'ab' } });
    const service = new ReceiptsServiceImpl(fakeTransactionsService());

    await expect(service.ocrOnly(Buffer.from('img'))).rejects.toThrow(ValidationError);
    await expect(service.ocrOnly(Buffer.from('img'))).rejects.toThrow(
      'No se pudo extraer texto legible de la imagen'
    );
  });
});
