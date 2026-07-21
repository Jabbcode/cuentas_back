import { describe, it, expect } from 'vitest';
import { groupByCategory } from '../projection.utils.js';

describe('groupByCategory', () => {
  it('lista vacía devuelve arreglo vacío', () => {
    expect(groupByCategory([])).toEqual([]);
  });

  it('agrupa items de la misma categoría y suma el total', () => {
    const items = [
      {
        id: 'fe-1',
        name: 'Alquiler',
        amount: 500,
        dueDay: 1,
        category: { id: 'cat-1', name: 'Vivienda', icon: '🏠', color: '#fff' },
      },
      {
        id: 'fe-2',
        name: 'Luz',
        amount: 100,
        dueDay: 5,
        category: { id: 'cat-1', name: 'Vivienda', icon: '🏠', color: '#fff' },
      },
    ];
    const result = groupByCategory(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ categoryId: 'cat-1', categoryName: 'Vivienda', total: 600 });
    expect(result[0].items).toHaveLength(2);
  });

  it('items sin categoría se agrupan bajo "uncategorized" / "Sin categoría"', () => {
    const items = [{ id: 'fe-1', name: 'Varios', amount: 50, dueDay: 10, category: null }];
    const result = groupByCategory(items);
    expect(result[0]).toMatchObject({ categoryId: 'uncategorized', categoryName: 'Sin categoría' });
  });

  it('ordena de mayor a menor total', () => {
    const items = [
      {
        id: 'fe-1',
        name: 'A',
        amount: 100,
        dueDay: 1,
        category: { id: 'cat-a', name: 'A', icon: null, color: null },
      },
      {
        id: 'fe-2',
        name: 'B',
        amount: 300,
        dueDay: 1,
        category: { id: 'cat-b', name: 'B', icon: null, color: null },
      },
    ];
    const result = groupByCategory(items);
    expect(result.map((c) => c.categoryId)).toEqual(['cat-b', 'cat-a']);
  });

  it('convierte amount tipo Decimal-like (con toString) a number', () => {
    const items = [
      {
        id: 'fe-1',
        name: 'X',
        amount: { toString: () => '250.5' },
        dueDay: 1,
        category: { id: 'cat-1', name: 'X', icon: null, color: null },
      },
    ];
    const result = groupByCategory(items);
    expect(result[0].total).toBe(250.5);
  });
});
