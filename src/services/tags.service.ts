import type { Prisma } from '@prisma/client';
import { NotFoundError } from '../lib/errors.js';
import * as tagRepo from '../repositories/tag.repository.js';

export async function getTags(userId: string, nameFilter?: string) {
  return tagRepo.findAllByUser(userId, nameFilter, { _count: { select: { transactions: true } } });
}

export async function getTagsSummary(userId: string) {
  type TagWithTx = Prisma.TagGetPayload<{
    include: {
      transactions: { include: { transaction: { select: { amount: true; type: true } } } };
    };
  }>;
  const tags = (await tagRepo.findAllByUser(userId, undefined, {
    transactions: { include: { transaction: { select: { amount: true, type: true } } } },
  })) as unknown as TagWithTx[];

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
  const tag = await tagRepo.findByIdAndUser(id, userId);
  if (!tag) throw new NotFoundError('Etiqueta no encontrada');
  return tagRepo.remove(id);
}

export async function upsertTags(userId: string, names: string[]): Promise<string[]> {
  const tagIds: string[] = [];
  for (const name of names) {
    const tag = await tagRepo.upsert(userId, name.trim().toLowerCase());
    tagIds.push(tag.id);
  }
  return tagIds;
}
