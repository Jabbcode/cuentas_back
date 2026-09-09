import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockedSend = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { id: 'email-1' } }));
const MockedResend = vi.hoisted(() =>
  vi.fn().mockImplementation(function () {
    return { emails: { send: mockedSend } };
  })
);

vi.mock('resend', () => ({ Resend: MockedResend }));

import { sendMonthlySummaryEmail } from '../index.js';

const baseParams = {
  to: 'user@example.com',
  userName: 'Juan',
  month: 'Julio',
  year: 2026,
  totalExpenses: 100,
  totalIncome: 200,
  categoryBreakdown: [],
};

describe('sendMonthlySummaryEmail', () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 're_test_key';
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
  });

  it('envía el email con from/to/subject/html correctos', async () => {
    await sendMonthlySummaryEmail(baseParams);

    expect(MockedResend).toHaveBeenCalledWith('re_test_key');
    expect(mockedSend).toHaveBeenCalledTimes(1);
    const [payload] = mockedSend.mock.calls[0];
    expect(payload.to).toBe('user@example.com');
    expect(payload.subject).toBe('Tu resumen de Julio 2026 - MisCuentas');
    expect(payload.html).toContain('Juan');
    // FROM_EMAIL se resuelve una vez al importar el módulo (RESEND_FROM_EMAIL
    // o el remitente por defecto) — no es reconfigurable por llamada.
    expect(payload.from).toBe('MisCuentas <noreply@miscuentas.app>');
  });

  it('lanza si RESEND_API_KEY no está configurada', async () => {
    delete process.env.RESEND_API_KEY;

    await expect(sendMonthlySummaryEmail(baseParams)).rejects.toThrow(
      'RESEND_API_KEY environment variable is not set'
    );
    expect(mockedSend).not.toHaveBeenCalled();
  });
});
