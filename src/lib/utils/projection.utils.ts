interface FixedExpenseWithCategory {
  id: string;
  name: string;
  amount: number | { toString(): string };
  dueDay: number;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

interface CategoryProjection {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  items: {
    id: string;
    name: string;
    amount: number;
    dueDay: number;
  }[];
}

export function groupByCategory(items: FixedExpenseWithCategory[]): CategoryProjection[] {
  const grouped = new Map<string, CategoryProjection>();

  items.forEach((item) => {
    const catId = item.category?.id || 'uncategorized';
    const catName = item.category?.name || 'Sin categoría';
    const catIcon = item.category?.icon || null;
    const catColor = item.category?.color || null;

    if (!grouped.has(catId)) {
      grouped.set(catId, {
        categoryId: catId,
        categoryName: catName,
        categoryIcon: catIcon,
        categoryColor: catColor,
        total: 0,
        items: [],
      });
    }

    const category = grouped.get(catId)!;
    category.total += Number(item.amount);
    category.items.push({
      id: item.id,
      name: item.name,
      amount: Number(item.amount),
      dueDay: item.dueDay,
    });
  });

  return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
}
