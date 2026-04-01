import { PrismaClient } from '@prisma/client';

/**
 * Script to fix credit card payment dates and links in production
 * Run with: DATABASE_URL="your-production-url" npx tsx src/scripts/fix-payment-dates.ts
 */

const prisma = new PrismaClient();

async function fixPaymentDates() {
  console.log('🔧 Corrigiendo fechas y vínculos de pagos...\n');

  // Find the Imagin credit card
  const card = await prisma.account.findFirst({
    where: {
      name: 'Imagin - Credito',
      type: 'credit_card',
      user: { email: 'jbriosob@gmail.com' },
    },
    include: {
      user: true,
    },
  });

  if (!card) {
    console.log('❌ Tarjeta no encontrada');
    return;
  }

  console.log(`💳 Procesando: ${card.name}\n`);

  // Find the payment transaction from Imagin - Débito
  const paymentCategory = await prisma.category.findFirst({
    where: {
      name: 'Pago de Tarjeta',
      userId: card.userId,
    },
  });

  if (!paymentCategory) {
    console.log('❌ Categoría "Pago de Tarjeta" no encontrada');
    return;
  }

  const debitoAccount = await prisma.account.findFirst({
    where: {
      name: 'Imagin - Débito',
      type: 'bank',
      userId: card.userId,
    },
  });

  if (!debitoAccount) {
    console.log('❌ Cuenta Imagin - Débito no encontrada');
    return;
  }

  // Find payment transaction from debito account
  const paymentTransaction = await prisma.transaction.findFirst({
    where: {
      accountId: debitoAccount.id,
      categoryId: paymentCategory.id,
      type: 'expense',
      amount: 797.11,
    },
    orderBy: { date: 'desc' },
  });

  if (!paymentTransaction) {
    console.log('❌ Transacción de pago no encontrada');
    return;
  }

  console.log(`✅ Transacción de pago encontrada:`);
  console.log(`   ID: ${paymentTransaction.id}`);
  console.log(`   Monto: €${Number(paymentTransaction.amount).toFixed(2)}`);
  console.log(`   Fecha: ${new Date(paymentTransaction.date).toLocaleDateString()}`);
  console.log(`   Desde: Imagin - Débito\n`);

  // Calculate correct period dates
  const cutoffDay = card.cutoffDay || 22;
  const paymentDate = new Date(paymentTransaction.date);

  // The payment on April 1 is for the period ending on March 22
  // Period: Feb 23 - Mar 22
  const periodEnd = new Date(paymentDate.getFullYear(), paymentDate.getMonth() - 1, cutoffDay);
  const periodStart = new Date(periodEnd);
  periodStart.setMonth(periodStart.getMonth() - 1);
  periodStart.setDate(periodStart.getDate() + 1);

  console.log(`📅 Fechas correctas del período:`);
  console.log(`   Inicio: ${periodStart.toLocaleDateString()}`);
  console.log(`   Fin: ${periodEnd.toLocaleDateString()}\n`);

  // Delete the incorrect payment record
  const incorrectPayment = await prisma.creditCardPayment.findFirst({
    where: { accountId: card.id },
  });

  if (incorrectPayment) {
    console.log(`🗑️  Eliminando registro incorrecto:`);
    console.log(`   Período: ${new Date(incorrectPayment.periodStart).toLocaleDateString()} - ${new Date(incorrectPayment.periodEnd).toLocaleDateString()}`);

    await prisma.creditCardPayment.delete({
      where: { id: incorrectPayment.id },
    });
    console.log('   ✅ Eliminado\n');
  }

  // Create correct payment record
  console.log(`✅ Creando registro de pago correcto...\n`);

  await prisma.creditCardPayment.create({
    data: {
      accountId: card.id,
      amount: paymentTransaction.amount,
      paymentDate: paymentTransaction.date,
      periodStart,
      periodEnd,
      transactionId: paymentTransaction.id,
    },
  });

  console.log('═'.repeat(60));
  console.log('✅ PAGO CORREGIDO EXITOSAMENTE');
  console.log('═'.repeat(60));
  console.log('\nResumen:');
  console.log(`   Período: ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`);
  console.log(`   Monto: €${Number(paymentTransaction.amount).toFixed(2)}`);
  console.log(`   Fecha de pago: ${new Date(paymentTransaction.date).toLocaleDateString()}`);
  console.log(`   Vinculado a transacción desde: Imagin - Débito`);
  console.log('\n✅ El período cerrado ahora debe mostrar como PAGADO\n');
}

fixPaymentDates()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
