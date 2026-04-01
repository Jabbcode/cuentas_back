import { prisma } from '../lib/prisma.js';

/**
 * Script to clean orphan credit card payments (payments without transactions)
 * Run with: npx tsx src/scripts/clean-orphan-payments.ts
 */

async function cleanOrphanPayments() {
  console.log('🧹 Cleaning orphan credit card payments...\n');

  // Find payments where the transaction was deleted
  const orphanPayments = await prisma.creditCardPayment.findMany({
    where: {
      OR: [
        { transactionId: null },
        { transaction: null },
      ],
    },
    include: {
      account: { select: { name: true } },
    },
  });

  if (orphanPayments.length === 0) {
    console.log('✅ No orphan payments found.');
    return;
  }

  console.log(`Found ${orphanPayments.length} orphan payment(s):\n`);

  for (const payment of orphanPayments) {
    console.log(`🗑️  Deleting payment:`);
    console.log(`   Card: ${payment.account.name}`);
    console.log(`   Amount: €${Number(payment.amount).toFixed(2)}`);
    console.log(`   Period: ${payment.periodStart.toISOString().split('T')[0]} to ${payment.periodEnd.toISOString().split('T')[0]}`);

    await prisma.creditCardPayment.delete({
      where: { id: payment.id },
    });

    console.log(`   ✅ Deleted\n`);
  }

  console.log(`\n✅ Cleaned ${orphanPayments.length} orphan payment(s)!`);
  console.log('💳 Your credit cards will now show as "unpaid" for those periods.');
}

cleanOrphanPayments()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
