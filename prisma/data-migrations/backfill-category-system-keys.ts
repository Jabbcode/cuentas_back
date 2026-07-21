import { PrismaClient, type Category } from '@prisma/client';
import {
  CATEGORY_SYSTEM_KEYS,
  type CategorySystemKey,
} from '../../src/lib/constants/category-system-keys.js';

const prisma = new PrismaClient();

const isConfirm = process.argv.includes('--confirm');

interface CandidateGroup {
  systemKey: CategorySystemKey;
  names: string[];
  canonicalName: string;
}

const GROUPS: CandidateGroup[] = [
  {
    systemKey: CATEGORY_SYSTEM_KEYS.DEBT_PAYMENT,
    names: ['Pago de Deuda', 'Pago de deuda'],
    canonicalName: 'Pago de Deuda',
  },
  {
    systemKey: CATEGORY_SYSTEM_KEYS.CREDIT_CARD_PAYMENT,
    names: ['Pago de Tarjeta'],
    canonicalName: 'Pago de Tarjeta',
  },
];

interface UserPlan {
  userId: string;
  systemKey: CategorySystemKey;
  canonicalId: string;
  canonicalName: string;
  currentName: string;
  willRename: boolean;
  mergedFrom: string[];
}

interface Anomaly {
  userId: string;
  systemKey: CategorySystemKey;
  reason: string;
  candidateIds: string[];
}

function pickCanonicalForGroup(candidates: Category[], canonicalName: string): Category {
  const withKey = candidates.find((c) => c.systemKey !== null);
  if (withKey) return withKey;
  const upperVariant = candidates.find((c) => c.name === canonicalName);
  if (upperVariant) return upperVariant;
  return candidates[0]!;
}

async function planForUserAndGroup(
  userId: string,
  group: CandidateGroup
): Promise<{ plan: UserPlan | null; anomaly: Anomaly | null }> {
  const candidates = await prisma.category.findMany({
    where: {
      userId,
      type: 'expense',
      OR: [{ systemKey: group.systemKey }, { name: { in: group.names } }],
    },
  });

  if (candidates.length === 0) return { plan: null, anomaly: null };

  const withSystemKeyCount = candidates.filter((c) => c.systemKey === group.systemKey).length;
  if (withSystemKeyCount > 1) {
    return {
      plan: null,
      anomaly: {
        userId,
        systemKey: group.systemKey,
        reason: `${withSystemKeyCount} categorías ya tienen systemKey='${group.systemKey}' (imposible por @@unique, revisar)`,
        candidateIds: candidates.map((c) => c.id),
      },
    };
  }

  const maxExpected = group.names.length + 1;
  if (candidates.length > maxExpected) {
    return {
      plan: null,
      anomaly: {
        userId,
        systemKey: group.systemKey,
        reason: `${candidates.length} candidatos, se esperaban máx. ${maxExpected}`,
        candidateIds: candidates.map((c) => c.id),
      },
    };
  }

  const canonical = pickCanonicalForGroup(candidates, group.canonicalName);
  const mergedFrom = candidates.filter((c) => c.id !== canonical.id).map((c) => c.id);

  return {
    plan: {
      userId,
      systemKey: group.systemKey,
      canonicalId: canonical.id,
      canonicalName: group.canonicalName,
      currentName: canonical.name,
      willRename: canonical.name !== group.canonicalName,
      mergedFrom,
    },
    anomaly: null,
  };
}

async function applyPlan(plan: UserPlan): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const dupId of plan.mergedFrom) {
      await tx.transaction.updateMany({
        where: { categoryId: dupId },
        data: { categoryId: plan.canonicalId },
      });
      await tx.fixedExpense.updateMany({
        where: { categoryId: dupId },
        data: { categoryId: plan.canonicalId },
      });
      await tx.category.delete({ where: { id: dupId } });
    }

    await tx.category.update({
      where: { id: plan.canonicalId },
      data: {
        systemKey: plan.systemKey,
        ...(plan.willRename ? { name: plan.canonicalName } : {}),
      },
    });
  });
}

async function main(): Promise<void> {
  console.log(`Modo: ${isConfirm ? 'REAL (--confirm)' : 'DRY-RUN (sin --confirm, no escribe)'}`);

  const users = await prisma.user.findMany({ select: { id: true } });

  const plans: UserPlan[] = [];
  const anomalies: Anomaly[] = [];

  for (const user of users) {
    for (const group of GROUPS) {
      const { plan, anomaly } = await planForUserAndGroup(user.id, group);
      if (anomaly) anomalies.push(anomaly);
      if (plan) plans.push(plan);
    }
  }

  if (anomalies.length > 0) {
    console.log('\n=== ANOMALÍAS DETECTADAS (no se tocarán estos casos) ===');
    for (const a of anomalies) {
      console.log(
        `  userId=${a.userId} systemKey=${a.systemKey}: ${a.reason} (ids: ${a.candidateIds.join(', ')})`
      );
    }
  }

  console.log(`\n=== PLAN (${plans.length} usuario×systemKey a procesar) ===`);
  for (const p of plans) {
    console.log(
      `  userId=${p.userId} systemKey=${p.systemKey} canonicalId=${p.canonicalId} ` +
        `rename=${p.willRename ? `"${p.currentName}"→"${p.canonicalName}"` : 'no'} ` +
        `mergedFrom=[${p.mergedFrom.join(', ') || '—'}]`
    );
  }

  if (!isConfirm) {
    console.log('\nDry-run: no se escribió nada. Ejecuta con --confirm para aplicar.');
    return;
  }

  console.log('\nAplicando cambios...');
  let ok = 0;
  let failed = 0;
  for (const plan of plans) {
    try {
      await applyPlan(plan);
      ok++;
    } catch (error) {
      failed++;
      console.error(
        `  FALLÓ userId=${plan.userId} systemKey=${plan.systemKey}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(`\nResumen: ${ok} aplicados, ${failed} fallidos de ${plans.length} totales.`);
  if (failed > 0) {
    console.log('Reejecuta el script (idempotente) para reintentar los fallidos.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
