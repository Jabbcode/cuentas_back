import { PrismaClient } from '@prisma/client';

/**
 * Script to fix production database
 * Run with: DATABASE_URL="your-production-url" npx tsx src/scripts/fix-production-data.ts
 */

const prisma = new PrismaClient();

async function fixProductionData() {
  console.log('🚀 Iniciando corrección de datos en producción...\n');

  // Verify we're using the right database
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('neon.tech') && !dbUrl.includes('production')) {
    console.log('⚠️  Advertencia: No parece ser URL de producción');
    console.log('   URL actual:', dbUrl.substring(0, 50) + '...\n');
  }

  try {
    // Step 1: Clean orphan credit card payments
    console.log('📋 Paso 1: Limpiando pagos de tarjeta huérfanos...\n');

    const payments = await prisma.creditCardPayment.findMany({
      include: {
        transaction: true,
        account: { select: { name: true, type: true } },
      },
    });

    console.log(`   Total de pagos registrados: ${payments.length}`);

    const orphanPayments = payments.filter((p) => !p.transaction);

    if (orphanPayments.length > 0) {
      console.log(`   ❌ Encontrados ${orphanPayments.length} pagos huérfanos\n`);

      for (const payment of orphanPayments) {
        console.log(`   Eliminando pago de ${payment.account.name}`);
        console.log(`     Monto: €${Number(payment.amount).toFixed(2)}`);
        console.log(`     Fecha: ${new Date(payment.paymentDate).toLocaleDateString()}`);

        await prisma.creditCardPayment.delete({
          where: { id: payment.id },
        });
      }
      console.log(`\n   ✅ ${orphanPayments.length} pagos huérfanos eliminados\n`);
    } else {
      console.log('   ✅ No hay pagos huérfanos\n');
    }

    // Step 2: Fix credit card balances
    console.log('📋 Paso 2: Recalculando balances de tarjetas de crédito...\n');

    const creditCards = await prisma.account.findMany({
      where: { type: 'credit_card' },
      include: {
        user: { select: { email: true } },
      },
    });

    console.log(`   Total de tarjetas de crédito: ${creditCards.length}\n`);

    for (const card of creditCards) {
      const oldBalance = Number(card.balance);

      // Get all transactions for this card
      const transactions = await prisma.transaction.findMany({
        where: { accountId: card.id },
        select: { amount: true, type: true },
      });

      // Calculate correct balance (negative = debt)
      // expenses increase debt (negative), income/payments decrease debt (positive)
      let calculatedBalance = Number(card.initialBalance);
      for (const tx of transactions) {
        if (tx.type === 'expense') {
          calculatedBalance -= Number(tx.amount);
        } else {
          calculatedBalance += Number(tx.amount);
        }
      }

      if (Math.abs(oldBalance - calculatedBalance) > 0.01) {
        console.log(`   🔧 ${card.name} (${card.user.email})`);
        console.log(`      Balance anterior: €${oldBalance.toFixed(2)}`);
        console.log(`      Balance correcto: €${calculatedBalance.toFixed(2)}`);
        console.log(`      Diferencia: €${(calculatedBalance - oldBalance).toFixed(2)}`);

        await prisma.account.update({
          where: { id: card.id },
          data: { balance: calculatedBalance },
        });
        console.log('      ✅ Corregido\n');
      } else {
        console.log(`   ✅ ${card.name} - Balance correcto\n`);
      }
    }

    // Step 3: Adjust Imagin Débito account
    console.log('📋 Paso 3: Ajustando cuenta Imagin - Débito...\n');

    const imaginAccount = await prisma.account.findFirst({
      where: {
        name: 'Imagin - Débito',
        type: 'bank',
      },
    });

    if (imaginAccount) {
      const transactions = await prisma.transaction.findMany({
        where: { accountId: imaginAccount.id },
        select: { amount: true, type: true },
      });

      const totalIncome = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalExpenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const targetBalance = 1216.90;
      const requiredInitialBalance = targetBalance - (totalIncome - totalExpenses);

      console.log(`   Balance actual: €${Number(imaginAccount.balance).toFixed(2)}`);
      console.log(`   Balance objetivo: €${targetBalance.toFixed(2)}`);
      console.log(`   Initial balance requerido: €${requiredInitialBalance.toFixed(2)}`);

      await prisma.account.update({
        where: { id: imaginAccount.id },
        data: {
          initialBalance: requiredInitialBalance,
          balance: targetBalance,
        },
      });

      console.log('   ✅ Cuenta Imagin ajustada\n');
    } else {
      console.log('   ⚠️  Cuenta Imagin no encontrada\n');
    }

    console.log('═'.repeat(60));
    console.log('✅ TODOS LOS AJUSTES COMPLETADOS EXITOSAMENTE');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    throw error;
  }
}

fixProductionData()
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
