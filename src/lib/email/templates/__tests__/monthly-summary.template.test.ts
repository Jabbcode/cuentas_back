import { describe, it, expect } from 'vitest';
import { buildMonthlySummaryHtml } from '../monthly-summary.template.js';
import type { MonthlySummaryParams } from '../../types.js';

function baseParams(overrides: Partial<MonthlySummaryParams> = {}): MonthlySummaryParams {
  return {
    to: 'user@example.com',
    userName: 'María',
    month: 'Agosto',
    year: 2026,
    totalExpenses: 300,
    totalIncome: 500,
    categoryBreakdown: [],
    ...overrides,
  };
}

describe('buildMonthlySummaryHtml', () => {
  it('interpola nombre, mes, año y los totales', () => {
    const html = buildMonthlySummaryHtml(baseParams());

    expect(html).toContain('María');
    expect(html).toContain('Agosto 2026');
    expect(html).toContain('€500.00');
    expect(html).toContain('€300.00');
  });

  it('balance positivo: muestra "Superávit" en color verde', () => {
    const html = buildMonthlySummaryHtml(baseParams({ totalIncome: 500, totalExpenses: 300 }));

    expect(html).toContain('Superávit');
    expect(html).toContain('#16a34a');
    expect(html).toContain('+€200.00');
  });

  it('balance negativo: muestra "Déficit" en color rojo', () => {
    const html = buildMonthlySummaryHtml(baseParams({ totalIncome: 100, totalExpenses: 300 }));

    expect(html).toContain('Déficit');
    expect(html).toContain('#dc2626');
    expect(html).toContain('€-200.00');
  });

  it('sin categorías: muestra el mensaje de "sin gastos registrados"', () => {
    const html = buildMonthlySummaryHtml(baseParams({ categoryBreakdown: [] }));

    expect(html).toContain('Sin gastos registrados este mes');
  });

  it('con categorías: renderiza cada fila con su porcentaje y emoji resuelto', () => {
    const html = buildMonthlySummaryHtml(
      baseParams({
        totalExpenses: 100,
        categoryBreakdown: [
          { name: 'Comida', icon: 'Utensils', spent: 75 },
          { name: 'Transporte', icon: 'DesconocidoXYZ', spent: 25 },
        ],
      })
    );

    expect(html).toContain('Comida');
    expect(html).toContain('🍴'); // ICON_EMOJI['Utensils']
    expect(html).toContain('75%');
    expect(html).toContain('Transporte');
    expect(html).toContain('25%');
    expect(html).toContain('€75.00');
  });

  it('categoría sin icon o con icon no mapeado: no revienta y omite el emoji', () => {
    const html = buildMonthlySummaryHtml(
      baseParams({
        totalExpenses: 50,
        categoryBreakdown: [{ name: 'Otros', spent: 50 }],
      })
    );

    expect(html).toContain('Otros');
  });
});
