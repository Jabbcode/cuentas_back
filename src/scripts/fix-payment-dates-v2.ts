import { PrismaClient } from '@prisma/client';

/**
 * Script to fix credit card payment dates (v2 - correct version)
 * Run with: DATABASE_URL="your-production-url" npx tsx src/scripts/fix-payment-dates-v2.ts
 */

const prisma = new PrismaClient();

async function fixPaymentDatesV2() {
  console.log('🔧 Corrigiendo fechas de pago (versión corregida)...\n');

  // Find the payment record
  const payment = await prisma.creditCardPayment.findFirst({
    where: {
      amount: 797.11,
    },
    include: {
      account: true,
      transaction: true,
    },
  });

  if (!payment) {
    console.log('❌ Pago no encontrado');
    return;
  }

  console.log('📋 Pago actual:');
  console.log(`   Tarjeta: ${payment.account.name}`);
  console.log(`   Monto: €${Number(payment.amount).toFixed(2)}`);
  console.log(`   Período actual: ${new Date(payment.periodStart).toLocaleDateString()} - ${new Date(payment.periodEnd).toLocaleDateString()}\n`);

  // Helper function to normalize dates to UTC midnight
  function normalizeToUTC(date: Date): Date {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
  }

  // Calculate correct dates according to service logic
  const cutoffDay = payment.account.cutoffDay || 22;
  const paymentDate = new Date(payment.paymentDate);

  // lastCutoff = March 22, 2026
  const lastCutoff = new Date(paymentDate.getFullYear(), paymentDate.getMonth() - 1, cutoffDay);

  // previousCutoff = February 22, 2026
  const previousCutoff = new Date(lastCutoff);
  previousCutoff.setMonth(previousCutoff.getMonth() - 1);

  // closedPeriodEnd = lastCutoff - 1 day = March 21, 2026
  const closedPeriodEnd = new Date(lastCutoff);
  closedPeriodEnd.setDate(closedPeriodEnd.getDate() - 1);

  // Normalize to UTC midnight
  const previousCutoffUTC = normalizeToUTC(previousCutoff);
  const closedPeriodEndUTC = normalizeToUTC(closedPeriodEnd);

  console.log('📅 Fechas correctas según lógica del servicio:');
  console.log(`   previousCutoff: ${previousCutoff.toLocaleDateString()}`);
  console.log(`   lastCutoff: ${lastCutoff.toLocaleDateString()}`);
  console.log(`   closedPeriodEnd (lastCutoff - 1): ${closedPeriodEnd.toLocaleDateString()}`);
  console.log(`   previousCutoffUTC: ${previousCutoffUTC.toISOString()}`);
  console.log(`   closedPeriodEndUTC: ${closedPeriodEndUTC.toISOString()}\n`);

  console.log('✅ Período correcto (UTC normalizado):');
  console.log(`   Inicio: ${previousCutoffUTC.toLocaleDateString()} (${previousCutoffUTC.toISOString()})`);
  console.log(`   Fin: ${closedPeriodEndUTC.toLocaleDateString()} (${closedPeriodEndUTC.toISOString()})\n`);

  // Update the payment record with UTC normalized dates
  await prisma.creditCardPayment.update({
    where: { id: payment.id },
    data: {
      periodStart: previousCutoffUTC,
      periodEnd: closedPeriodEndUTC,
    },
  });

  console.log('═'.repeat(60));
  console.log('✅ FECHAS CORREGIDAS EXITOSAMENTE');
  console.log('═'.repeat(60));
  console.log('\nResumen:');
  console.log(`   Período: ${previousCutoff.toLocaleDateString()} - ${closedPeriodEnd.toLocaleDateString()}`);
  console.log(`   Monto: €${Number(payment.amount).toFixed(2)}`);
  console.log(`   Fecha de pago: ${new Date(payment.paymentDate).toLocaleDateString()}`);
  console.log('\n✅ Ahora el período cerrado debe mostrar como PAGADO\n');
}

fixPaymentDatesV2()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
