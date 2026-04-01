import { prisma } from '../lib/prisma.js';

/**
 * Script to check what categories are showing in the dashboard
 * Run with: npx tsx src/scripts/check-dashboard-categories.ts
 */

async function checkDashboardCategories() {
  console.log('🔍 Verificando gastos por categoría...\n');

  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  for (const user of users) {
    console.log(`\n👤 Usuario: ${user.email}`);
    console.log('─'.repeat(50));

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    console.log(`📅 Período: ${startOfMonth.toLocaleDateString()} - ${endOfMonth.toLocaleDateString()}\n`);

    // Get all expense transactions for this month
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: 'expense',
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        account: { select: { name: true, type: true } },
      },
      orderBy: { date: 'desc' },
    });

    console.log(`📊 Total de transacciones de gasto: ${transactions.length}\n`);

    if (transactions.length === 0) {
      console.log('❌ No hay transacciones de gasto este mes.\n');
      continue;
    }

    // Group by category
    const byCategory = transactions.reduce<Record<string, { category: any; total: number; count: number; accounts: Set<string> }>>((acc, t) => {
      const catId = t.category.id;
      if (!acc[catId]) {
        acc[catId] = {
          category: t.category,
          total: 0,
          count: 0,
          accounts: new Set()
        };
      }
      acc[catId].total += Number(t.amount);
      acc[catId].count += 1;
      acc[catId].accounts.add(`${t.account.name} (${t.account.type})`);
      return acc;
    }, {});

    const total = Object.values(byCategory).reduce((sum, c) => sum + c.total, 0);

    console.log('📈 Resumen por categoría:\n');

    const sorted = Object.values(byCategory).sort((a, b) => b.total - a.total);

    for (const cat of sorted) {
      const percentage = Math.round((cat.total / total) * 100);
      console.log(`  ${cat.category.icon || '📦'} ${cat.category.name}`);
      console.log(`     Monto: €${cat.total.toFixed(2)} (${percentage}%)`);
      console.log(`     Transacciones: ${cat.count}`);
      console.log(`     Cuentas: ${Array.from(cat.accounts).join(', ')}`);
      console.log('');
    }

    console.log(`💰 TOTAL GASTADO: €${total.toFixed(2)}\n`);

    // Show some sample transactions
    console.log('🧾 Últimas 5 transacciones:\n');
    transactions.slice(0, 5).forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.category.name} - €${Number(t.amount).toFixed(2)}`);
      console.log(`     ${t.description || 'Sin descripción'}`);
      console.log(`     Cuenta: ${t.account.name} (${t.account.type})`);
      console.log(`     Fecha: ${new Date(t.date).toLocaleDateString()}`);
      console.log('');
    });
  }
}

checkDashboardCategories()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
