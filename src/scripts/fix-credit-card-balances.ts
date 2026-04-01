import { prisma } from '../lib/prisma.js';

/**
 * Script to fix credit card balances by recalculating from transactions
 * Run with: npx tsx src/scripts/fix-credit-card-balances.ts
 */

async function fixCreditCardBalances() {
  console.log('🔧 Fixing credit card balances...\n');

  // Get all credit card accounts
  const creditCards = await prisma.account.findMany({
    where: { type: 'credit_card' },
    include: {
      user: { select: { email: true } },
    },
  });

  if (creditCards.length === 0) {
    console.log('❌ No credit cards found.');
    return;
  }

  console.log(`Found ${creditCards.length} credit card(s)\n`);

  for (const card of creditCards) {
    console.log(`\n📋 Processing: ${card.name} (${card.user.email})`);
    console.log(`   Current balance: ${card.balance}`);

    // Get all transactions for this card
    const transactions = await prisma.transaction.findMany({
      where: { accountId: card.id },
      orderBy: { date: 'asc' },
    });

    console.log(`   Total transactions: ${transactions.length}`);

    // Calculate correct balance
    // For credit cards: income (payments) increases balance, expenses decrease it
    let correctBalance = 0;
    for (const tx of transactions) {
      if (tx.type === 'income') {
        correctBalance += Number(tx.amount);
      } else {
        correctBalance -= Number(tx.amount);
      }
    }

    console.log(`   Calculated balance: ${correctBalance}`);
    console.log(`   Difference: ${Number(card.balance) - correctBalance}`);

    if (Number(card.balance) !== correctBalance) {
      // Update the balance
      await prisma.account.update({
        where: { id: card.id },
        data: { balance: correctBalance },
      });
      console.log(`   ✅ Balance updated to ${correctBalance}`);
    } else {
      console.log(`   ✅ Balance is already correct`);
    }

    // Show usage info
    const creditLimit = Number(card.creditLimit || 0);
    const totalUsed = Math.abs(correctBalance);
    const available = creditLimit - totalUsed;
    const usagePercentage = creditLimit > 0 ? Math.round((totalUsed / creditLimit) * 100) : 0;

    console.log(`\n   💳 Card details:`);
    console.log(`      Credit limit: €${creditLimit.toFixed(2)}`);
    console.log(`      Total used: €${totalUsed.toFixed(2)} (${usagePercentage}%)`);
    console.log(`      Available: €${available.toFixed(2)}`);
  }

  console.log('\n\n✅ All credit card balances have been fixed!');
}

fixCreditCardBalances()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
