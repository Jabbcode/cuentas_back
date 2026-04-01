import { prisma } from '../lib/prisma.js';

/**
 * Script to fix NaN initial balance
 * Run with: npx tsx src/scripts/fix-nan-initial-balance.ts
 */

async function fixNanInitialBalance() {
  console.log('🔍 Buscando cuentas con initialBalance inválido...\n');

  const accounts = await prisma.account.findMany({
    include: {
      user: { select: { email: true } },
    },
  });

  console.log(`📊 Total de cuentas: ${accounts.length}\n`);

  const problematicAccounts = accounts.filter((acc) => {
    const initial = Number(acc.initialBalance);
    return isNaN(initial);
  });

  if (problematicAccounts.length === 0) {
    console.log('✅ No hay cuentas con initialBalance inválido');
    return;
  }

  console.log(`❌ Encontradas ${problematicAccounts.length} cuentas con initialBalance inválido:\n`);

  for (const account of problematicAccounts) {
    console.log(`📋 ${account.name} (${account.type})`);
    console.log(`   Usuario: ${account.user.email}`);
    console.log(`   initialBalance actual: ${account.initialBalance} (${typeof account.initialBalance})`);
    console.log(`   balance actual: €${Number(account.balance).toFixed(2)}`);

    // Get transactions to calculate what initial balance should be
    const transactions = await prisma.transaction.findMany({
      where: { accountId: account.id },
      select: { amount: true, type: true },
    });

    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const currentBalance = Number(account.balance);
    const calculatedInitial = currentBalance - totalIncome + totalExpenses;

    console.log(`   Transacciones: ${transactions.length} (${totalIncome.toFixed(2)} ingresos - ${totalExpenses.toFixed(2)} gastos)`);
    console.log(`   initialBalance calculado: €${calculatedInitial.toFixed(2)}`);

    // If calculated initial is the difference, it means initial was 0
    if (Math.abs(currentBalance - (totalIncome - totalExpenses)) < 0.01) {
      console.log(`   → El balance inicial debería ser €0.00`);

      // Fix it
      await prisma.account.update({
        where: { id: account.id },
        data: { initialBalance: 0 },
      });
      console.log(`   ✅ Corregido a €0.00\n`);
    } else {
      console.log(`   → El balance inicial debería ser €${calculatedInitial.toFixed(2)}`);

      // Fix it
      await prisma.account.update({
        where: { id: account.id },
        data: { initialBalance: calculatedInitial },
      });
      console.log(`   ✅ Corregido a €${calculatedInitial.toFixed(2)}\n`);
    }
  }

  console.log('✅ Corrección completada');
}

fixNanInitialBalance()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
