import { describe, it, expect, vi } from 'vitest';

const mockedCreateMany = vi.hoisted(() => vi.fn().mockResolvedValue({ count: 15 }));

vi.mock('../prisma.js', () => ({
  prisma: { category: { createMany: mockedCreateMany } },
}));

import { seedCategories } from '../seed.js';

describe('seedCategories', () => {
  it('crea 10 categorías de gasto y 5 de ingreso, todas con userId y skipDuplicates', async () => {
    await seedCategories('user-1');

    expect(mockedCreateMany).toHaveBeenCalledTimes(1);
    const [{ data, skipDuplicates }] = mockedCreateMany.mock.calls[0];

    expect(skipDuplicates).toBe(true);
    expect(data).toHaveLength(15);
    expect(data.filter((c: { type: string }) => c.type === 'expense')).toHaveLength(10);
    expect(data.filter((c: { type: string }) => c.type === 'income')).toHaveLength(5);
    expect(data.every((c: { userId: string }) => c.userId === 'user-1')).toBe(true);
    expect(data[0]).toMatchObject({ name: 'Alimentación', icon: 'Utensils', color: '#FF6B6B' });
  });
});
