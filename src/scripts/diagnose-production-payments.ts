import { PrismaClient } from '@prisma/client';

/**
 * Script to diagnose credit card payments in production
 * Run with: DATABASE_URL="your-production-url" npx tsx src/scripts/diagnose-production-payments.ts
 */

const prisma = new PrismaClient();

async function diagnosePayments() {
  console.log('🔍 Diagnosticando pagos de tarjeta en producción...\n');

  // Get all credit cards
  const cards = await prisma.account.findMany({
    where: { type: 'credit_card' },
    include: {
      user: { select: { email: true } },
    },
  });

  console.log(`📊 Total de tarjetas: ${cards.length}\n`);

  for (const card of cards) {
    console.log('═'.repeat(60));
    console.log(`💳 ${card.name}`);
    console.log(`   Usuario: ${card.user.email}`);
    console.log(`   Balance: €${Number(card.balance).toFixed(2)}`);
    console.log(`   Límite: €${Number(card.creditLimit || 0).toFixed(2)}`);
    console.log(`   Corte: día ${card.cutoffDay}, Pago: día ${card.paymentDueDay}\n`);

    // Get all transactions for this card
    const transactions = await prisma.transaction.findMany({
      where: { accountId: card.id },
      include: {
        category: { select: { name: true, icon: true } },
      },
      orderBy: { date: 'desc' },
    });

    console.log(`   📝 Transacciones totales: ${transactions.length}\n`);

    // Show recent transactions
    if (transactions.length > 0) {
      console.log('   Últimas 5 transacciones:');
      transactions.slice(0, 5).forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.type === 'income' ? '💰' : '💸'} ${tx.category.icon || ''} ${tx.category.name}`);
        console.log(`      Monto: €${Number(tx.amount).toFixed(2)}`);
        console.log(`      Fecha: ${new Date(tx.date).toLocaleDateString()}`);
        console.log(`      Descripción: ${tx.description || 'N/A'}`);
      });
      console.log('');
    }

    // Get CreditCardPayments for this card
    const payments = await prisma.creditCardPayment.findMany({
      where: { accountId: card.id },
      include: {
        transaction: {
          include: {
            account: { select: { name: true, type: true } },
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    console.log(`   💳 Pagos registrados (CreditCardPayment): ${payments.length}\n`);

    if (payments.length > 0) {
      payments.forEach((payment, i) => {
        console.log(`   Pago ${i + 1}:`);
        console.log(`      Monto: €${Number(payment.amount).toFixed(2)}`);
        console.log(`      Fecha de pago: ${new Date(payment.paymentDate).toLocaleDateString()}`);
        console.log(`      Período: ${new Date(payment.periodStart).toLocaleDateString()} - ${new Date(payment.periodEnd).toLocaleDateString()}`);
        if (payment.transaction) {
          console.log(`      ✅ Transacción vinculada:`);
          console.log(`         Desde: ${payment.transaction.account.name}`);
          console.log(`         Categoría: ${payment.transaction.category.name}`);
        } else {
          console.log(`      ❌ Sin transacción vinculada (HUÉRFANO)`);
        }
        console.log('');
      });
    } else {
      console.log('   ❌ No hay pagos registrados en CreditCardPayment\n');
    }

    // Check current period dates
    const now = new Date();
    const cutoffDay = card.cutoffDay || 1;

    let currentCutoff = new Date(now.getFullYear(), now.getMonth(), cutoffDay);
    if (now.getDate() < cutoffDay) {
      currentCutoff.setMonth(currentCutoff.getMonth() - 1);
    }

    let lastCutoff = new Date(currentCutoff);
    lastCutoff.setMonth(lastCutoff.getMonth() - 1);

    let nextCutoff = new Date(currentCutoff);
    nextCutoff.setMonth(nextCutoff.getMonth() + 1);

    console.log('   📅 Períodos calculados:');
    console.log(`      Período cerrado: ${new Date(lastCutoff.getTime() + 86400000).toLocaleDateString()} - ${currentCutoff.toLocaleDateString()}`);
    console.log(`      Período actual: ${new Date(currentCutoff.getTime() + 86400000).toLocaleDateString()} - ${nextCutoff.toLocaleDateString()}\n`);

    // Check if closed period has payment
    const closedPeriodPayment = payments.find((p) => {
      const pStart = new Date(p.periodStart);
      const pEnd = new Date(p.periodEnd);
      return pStart.getTime() === lastCutoff.getTime() + 86400000 &&
             pEnd.getTime() === currentCutoff.getTime();
    });

    if (closedPeriodPayment) {
      console.log('   ✅ El período cerrado TIENE pago registrado\n');
    } else {
      console.log('   ❌ El período cerrado NO TIENE pago registrado\n');

      // Check for transactions that look like payments
      const paymentCategory = await prisma.category.findFirst({
        where: {
          name: 'Pago de Tarjeta',
          userId: card.userId,
        },
      });

      if (paymentCategory) {
        const paymentTransactions = await prisma.transaction.findMany({
          where: {
            categoryId: paymentCategory.id,
            type: 'expense',
            date: {
              gte: lastCutoff,
              lte: new Date(),
            },
          },
          include: {
            account: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
        });

        if (paymentTransactions.length > 0) {
          console.log('   💡 Encontradas transacciones de pago sin registro en CreditCardPayment:');
          paymentTransactions.forEach((tx) => {
            console.log(`      - €${Number(tx.amount).toFixed(2)} desde ${tx.account.name} el ${new Date(tx.date).toLocaleDateString()}`);
          });
          console.log('\n   ⚠️  Estas transacciones deberían crear registros en CreditCardPayment\n');
        }
      }
    }

    console.log('');
  }

  console.log('═'.repeat(60));
}

diagnosePayments()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
