import { prisma } from '../lib/prisma.js';

/**
 * Script to check account balance calculation
 * Run with: npx tsx src/scripts/check-account-balance.ts
 */

async function checkAccountBalance() {
  console.log('🔍 Verificando balance de cuenta Imagin - Débito...\n');

  const account = await prisma.account.findFirst({
    where: {
      name: 'Imagin - Débito',
      type: 'bank',
    },
    include: {
      user: { select: { email: true } },
    },
  });

  if (!account) {
    console.log('❌ Cuenta no encontrada');
    return;
  }

  console.log(`📋 Cuenta encontrada:`);
  console.log(`   ID: ${account.id}`);
  console.log(`   Usuario: ${account.user.email}`);
  console.log(`   Balance en BD: €${Number(account.balance).toFixed(2)}`);
  console.log(`   Balance inicial: €${Number(account.initialBalance).toFixed(2)}\n`);

  // Get all transactions for this account
  const transactions = await prisma.transaction.findMany({
    where: { accountId: account.id },
    include: {
      category: { select: { name: true, icon: true } },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`📊 Total de transacciones: ${transactions.length}\n`);

  // Calculate expected balance
  let calculatedBalance = Number(account.initialBalance);
  let totalIncome = 0;
  let totalExpenses = 0;

  console.log('📝 Detalle de transacciones:\n');

  transactions.forEach((tx, index) => {
    const amount = Number(tx.amount);
    const before = calculatedBalance;

    if (tx.type === 'income') {
      calculatedBalance += amount;
      totalIncome += amount;
    } else {
      calculatedBalance -= amount;
      totalExpenses += amount;
    }

    // Show first 10 and last 10 transactions
    if (index < 10 || index >= transactions.length - 10) {
      console.log(`${index + 1}. ${tx.type === 'income' ? '💰' : '💸'} ${tx.category.icon || '📦'} ${tx.category.name}`);
      console.log(`   Monto: €${amount.toFixed(2)}`);
      console.log(`   ${tx.description || 'Sin descripción'}`);
      console.log(`   Fecha: ${new Date(tx.date).toLocaleDateString()}`);
      console.log(`   Balance: €${before.toFixed(2)} → €${calculatedBalance.toFixed(2)}`);
      console.log('');
    } else if (index === 10) {
      console.log('   ... (transacciones intermedias omitidas) ...\n');
    }
  });

  console.log('─'.repeat(60));
  console.log('\n📈 Resumen:\n');
  console.log(`   Balance inicial: €${Number(account.initialBalance).toFixed(2)}`);
  console.log(`   Total ingresos: +€${totalIncome.toFixed(2)}`);
  console.log(`   Total gastos: -€${totalExpenses.toFixed(2)}`);
  console.log(`   Balance calculado: €${calculatedBalance.toFixed(2)}`);
  console.log(`   Balance en BD: €${Number(account.balance).toFixed(2)}`);
  console.log(`   Diferencia: €${(Number(account.balance) - calculatedBalance).toFixed(2)}`);

  if (Math.abs(Number(account.balance) - calculatedBalance) > 0.01) {
    console.log('\n❌ HAY UNA DISCREPANCIA EN EL BALANCE');
    console.log(`   El balance en la BD debería ser €${calculatedBalance.toFixed(2)}`);
    console.log(`   pero está en €${Number(account.balance).toFixed(2)}`);

    console.log('\n🔧 ¿Quieres corregir el balance? (Este script solo muestra el problema)');
  } else {
    console.log('\n✅ El balance está correcto');
  }

  // Check for transactions by type
  console.log('\n📊 Desglose por tipo:\n');
  const incomeCount = transactions.filter(t => t.type === 'income').length;
  const expenseCount = transactions.filter(t => t.type === 'expense').length;
  console.log(`   Ingresos: ${incomeCount} transacciones (€${totalIncome.toFixed(2)})`);
  console.log(`   Gastos: ${expenseCount} transacciones (€${totalExpenses.toFixed(2)})`);
}

checkAccountBalance()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
