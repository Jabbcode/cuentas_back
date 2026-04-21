import { resolveIcon } from '../constants.js';
import type { CategoryEmailData, MonthlySummaryParams } from '../types.js';

function progressBar(percentage: number, color: string): string {
  const clamped = Math.min(100, Math.round(percentage));
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px">
      <tr>
        <td style="background:#e5e7eb;border-radius:99px;height:6px;overflow:hidden">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:${clamped}%;background:${color};height:6px;border-radius:99px;display:block"></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function categoryRow(c: CategoryEmailData, totalExpenses: number): string {
  const pctOfTotal = totalExpenses > 0 ? (c.spent / totalExpenses) * 100 : 0;
  const hasBudget = c.budget !== undefined && c.budget > 0;
  const budgetPct = hasBudget ? (c.spent / c.budget!) * 100 : 0;
  const isOver = hasBudget && c.spent > c.budget!;

  const barColor = isOver ? '#dc2626' : hasBudget && budgetPct >= 80 ? '#f59e0b' : '#2563eb';
  const icon = resolveIcon(c.icon);

  const budgetLabel = hasBudget
    ? `<span style="font-size:11px;color:${isOver ? '#dc2626' : '#6b7280'}">
        ${isOver ? '⚠️ ' : ''}€${c.spent.toFixed(2)} / €${c.budget!.toFixed(2)} (${Math.round(budgetPct)}%)
       </span>`
    : `<span style="font-size:11px;color:#6b7280">€${c.spent.toFixed(2)}</span>`;

  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:14px;color:#1f2937;font-weight:500">
              ${icon ? `<span style="margin-right:6px">${icon}</span>` : ''}${c.name}
            </td>
            <td style="text-align:right;font-size:13px;font-weight:600;color:#1f2937;white-space:nowrap">
              ${Math.round(pctOfTotal)}%
            </td>
          </tr>
          <tr>
            <td colspan="2">${progressBar(hasBudget ? budgetPct : pctOfTotal, barColor)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:2px">${budgetLabel}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function buildMonthlySummaryHtml(params: MonthlySummaryParams): string {
  const { userName, month, year, totalExpenses, totalIncome, categoryBreakdown } = params;

  const netBalance = totalIncome - totalExpenses;
  const netColor = netBalance >= 0 ? '#16a34a' : '#dc2626';
  const netLabel = netBalance >= 0 ? '▲ Superávit' : '▼ Déficit';
  const categoryRows = categoryBreakdown.map((c) => categoryRow(c, totalExpenses)).join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:16px 16px 0 0;padding:32px 32px 24px;text-align:center">
              <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">💰 MisCuentas</p>
              <p style="margin:0;font-size:14px;color:#bfdbfe">Resumen mensual · ${month} ${year}</p>
            </td>
          </tr>

          <!-- GREETING -->
          <tr>
            <td style="background:#ffffff;padding:24px 32px 0">
              <p style="margin:0;font-size:16px;color:#374151">
                Hola <strong>${userName}</strong>, aquí tienes tu resumen financiero de <strong>${month}</strong>.
              </p>
            </td>
          </tr>

          <!-- NET BALANCE -->
          <tr>
            <td style="background:#ffffff;padding:20px 32px">
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:${netBalance >= 0 ? '#f0fdf4' : '#fef2f2'};border:1px solid ${netBalance >= 0 ? '#bbf7d0' : '#fecaca'};border-radius:12px;padding:20px">
                <tr>
                  <td style="text-align:center">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${netColor};text-transform:uppercase;letter-spacing:0.5px">${netLabel}</p>
                    <p style="margin:0;font-size:36px;font-weight:700;color:${netColor}">
                      ${netBalance >= 0 ? '+' : ''}€${netBalance.toFixed(2)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- INCOME / EXPENSES -->
          <tr>
            <td style="background:#ffffff;padding:0 32px 24px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px">Ingresos</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#15803d">€${totalIncome.toFixed(2)}</p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;text-align:center">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px">Gastos</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#b91c1c">€${totalExpenses.toFixed(2)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="background:#ffffff;padding:0 32px">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0">
            </td>
          </tr>

          <!-- CATEGORIES -->
          <tr>
            <td style="background:#ffffff;padding:24px 32px">
              <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#111827">Gastos por categoría</p>
              ${
                categoryBreakdown.length > 0
                  ? `<table width="100%" cellpadding="0" cellspacing="0">${categoryRows}</table>`
                  : `<p style="margin:0;font-size:14px;color:#9ca3af;font-style:italic">Sin gastos registrados este mes.</p>`
              }
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center">
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280">
                Este correo fue generado automáticamente por <strong>MisCuentas</strong>.
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af">
                Puedes desactivar estas notificaciones en
                <a href="#" style="color:#2563eb;text-decoration:none">Configuración → Notificaciones</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
