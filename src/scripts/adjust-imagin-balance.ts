import { prisma } from '../lib/prisma.js';

/**
 * Script to adjust Imagin Débito account balance to match real balance
 * Run with: npx tsx src/scripts/adjust-imagin-balance.ts
 */

async function adjustImaginBalance() {
  console.log('🔧 Ajustando balance de cuenta Imagin - Débito...\n');

  const account = await prisma.account.findFirst({
    where: {
      name: 'Imagin - Débito',
      type: 'bank',
    },
  });

  if (!account) {
    console.log('❌ Cuenta no encontrada');
    return;
  }

  console.log('📋 Cuenta encontrada:');
  console.log(`   Balance actual en sistema: €${Number(account.balance).toFixed(2)}`);
  console.log(`   Balance inicial actual: €${Number(account.initialBalance).toFixed(2)}\n`);

  // Get all transactions
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

  console.log('📊 Transacciones registradas:');
  console.log(`   Total ingresos: €${totalIncome.toFixed(2)}`);
  console.log(`   Total gastos: €${totalExpenses.toFixed(2)}`);
  console.log(`   Diferencia neta: €${(totalIncome - totalExpenses).toFixed(2)}\n`);

  // Target balance
  const targetBalance = 1216.90;
  const requiredInitialBalance = targetBalance - (totalIncome - totalExpenses);

  console.log('🎯 Ajuste necesario:');
  console.log(`   Balance real actual: €${targetBalance.toFixed(2)}`);
  console.log(`   Balance inicial requerido: €${requiredInitialBalance.toFixed(2)}\n`);

  // Update account
  await prisma.account.update({
    where: { id: account.id },
    data: {
      initialBalance: requiredInitialBalance,
      balance: targetBalance,
    },
  });

  console.log('✅ Cuenta ajustada correctamente\n');

  // Verify
  const updatedAccount = await prisma.account.findUnique({
    where: { id: account.id },
  });

  console.log('📋 Balance final:');
  console.log(`   Balance inicial: €${Number(updatedAccount!.initialBalance).toFixed(2)}`);
  console.log(`   + Ingresos: €${totalIncome.toFixed(2)}`);
  console.log(`   - Gastos: €${totalExpenses.toFixed(2)}`);
  console.log(`   = Balance final: €${Number(updatedAccount!.balance).toFixed(2)}`);
  console.log('\n✅ La cuenta ahora refleja tu balance bancario real');
}

adjustImaginBalance()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
