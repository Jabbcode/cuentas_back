import { Resend } from 'resend';
import { buildMonthlySummaryHtml } from './templates/monthly-summary.template.js';
import type { MonthlySummaryParams } from './types.js';

export type { CategoryEmailData, MonthlySummaryParams } from './types.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'MisCuentas <noreply@miscuentas.app>';

export async function sendMonthlySummaryEmail(params: MonthlySummaryParams): Promise<void> {
  const { to, month, year } = params;

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Tu resumen de ${month} ${year} - MisCuentas`,
    html: buildMonthlySummaryHtml(params),
  });
}
