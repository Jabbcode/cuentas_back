import { prisma } from '../lib/prisma.js';

/**
 * Script to list all credit card payments
 * Run with: npx tsx src/scripts/list-credit-card-payments.ts
 */

async function listPayments() {
  console.log('💳 Listing all credit card payments...\n');

  const payments = await prisma.creditCardPayment.findMany({
    include: {
      account: { select: { name: true } },
      transaction: { select: { id: true, amount: true, date: true } },
    },
    orderBy: { paymentDate: 'desc' },
  });

  if (payments.length === 0) {
    console.log('❌ No credit card payments found.');
    return;
  }

  console.log(`Found ${payments.length} payment(s):\n`);

  for (const payment of payments) {
    console.log(`📋 Payment ID: ${payment.id}`);
    console.log(`   Card: ${payment.account.name}`);
    console.log(`   Amount: €${Number(payment.amount).toFixed(2)}`);
    console.log(`   Payment Date: ${payment.paymentDate.toISOString().split('T')[0]}`);
    console.log(`   Period: ${payment.periodStart.toISOString().split('T')[0]} to ${payment.periodEnd.toISOString().split('T')[0]}`);
    console.log(`   Transaction ID: ${payment.transactionId || '❌ DELETED'}`);
    if (payment.transaction) {
      console.log(`   Transaction exists: ✅`);
    } else {
      console.log(`   Transaction exists: ❌ (deleted)`);
    }
    console.log('');
  }
}

listPayments()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
