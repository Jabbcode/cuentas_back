import { prisma } from '../lib/prisma.js';

export async function getTags(userId: string, nameFilter?: string) {
  return prisma.tag.findMany({
    where: {
      userId,
      ...(nameFilter ? { name: { contains: nameFilter, mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
    include: { _count: { select: { transactions: true } } },
  });
}

export async function getTagsSummary(userId: string) {
  const tags = await prisma.tag.findMany({
    where: { userId },
    include: {
      transactions: {
        include: {
          transaction: { select: { amount: true, type: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    count: tag.transactions.length,
    totalExpenses: tag.transactions
      .filter((tt) => tt.transaction.type === 'expense')
      .reduce((sum, tt) => sum + Number(tt.transaction.amount), 0),
    totalIncome: tag.transactions
      .filter((tt) => tt.transaction.type === 'income')
      .reduce((sum, tt) => sum + Number(tt.transaction.amount), 0),
  }));
}

export async function deleteTag(id: string, userId: string) {
  const tag = await prisma.tag.findFirst({ where: { id, userId } });
  if (!tag) throw new Error('Etiqueta no encontrada');
  return prisma.tag.delete({ where: { id } });
}

export async function upsertTags(userId: string, names: string[]): Promise<string[]> {
  const tagIds: string[] = [];
  for (const name of names) {
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name: name.trim().toLowerCase() } },
      update: {},
      create: { name: name.trim().toLowerCase(), userId },
    });
    tagIds.push(tag.id);
  }
  return tagIds;
}
