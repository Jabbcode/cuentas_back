import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugPaymentExact() {
  console.log('🔍 Verificación exacta de pago en producción...\n');

  // Get the card
  const card = await prisma.account.findFirst({
    where: {
      name: 'Imagin - Credito',
      type: 'credit_card',
      user: { email: 'jbriosob@gmail.com' },
    },
  });

  if (!card) {
    console.log('❌ Tarjeta no encontrada');
    return;
  }

  console.log(`💳 Tarjeta: ${card.name}`);
  console.log(`   ID: ${card.id}`);
  console.log(`   Día de corte: ${card.cutoffDay}\n`);

  // Calculate dates exactly as service does
  const cutoffDay = card.cutoffDay || 22;
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let lastCutoff: Date;
  let nextCutoff: Date;

  if (currentDay >= cutoffDay) {
    lastCutoff = new Date(currentYear, currentMonth, cutoffDay);
    nextCutoff = new Date(currentYear, currentMonth + 1, cutoffDay);
  } else {
    lastCutoff = new Date(currentYear, currentMonth - 1, cutoffDay);
    nextCutoff = new Date(currentYear, currentMonth, cutoffDay);
  }

  const previousCutoff = new Date(lastCutoff);
  previousCutoff.setMonth(previousCutoff.getMonth() - 1);

  const closedPeriodEnd = new Date(lastCutoff);
  closedPeriodEnd.setDate(closedPeriodEnd.getDate() - 1);

  console.log('📅 Fechas calculadas por el servicio:');
  console.log(`   Hoy: ${today.toISOString()}`);
  console.log(`   lastCutoff: ${lastCutoff.toISOString()}`);
  console.log(`   previousCutoff: ${previousCutoff.toISOString()}`);
  console.log(`   closedPeriodEnd: ${closedPeriodEnd.toISOString()}\n`);

  console.log('🔎 Buscando pago con ESTAS fechas exactas:\n');
  console.log(`   WHERE accountId = "${card.id}"`);
  console.log(`   AND periodStart = ${previousCutoff.toISOString()}`);
  console.log(`   AND periodEnd = ${closedPeriodEnd.toISOString()}\n`);

  // Search exactly as service does
  const closedPeriodPayment = await prisma.creditCardPayment.findFirst({
    where: {
      accountId: card.id,
      periodStart: previousCutoff,
      periodEnd: closedPeriodEnd,
    },
  });

  if (closedPeriodPayment) {
    console.log('✅ PAGO ENCONTRADO:');
    console.log(`   ID: ${closedPeriodPayment.id}`);
    console.log(`   Monto: €${Number(closedPeriodPayment.amount).toFixed(2)}`);
    console.log(`   periodStart: ${new Date(closedPeriodPayment.periodStart).toISOString()}`);
    console.log(`   periodEnd: ${new Date(closedPeriodPayment.periodEnd).toISOString()}`);
    console.log(`   paymentDate: ${new Date(closedPeriodPayment.paymentDate).toISOString()}\n`);
    console.log('✅ El período debería mostrar como PAGADO\n');
  } else {
    console.log('❌ PAGO NO ENCONTRADO\n');
    console.log('Buscando todos los pagos de esta tarjeta...\n');

    const allPayments = await prisma.creditCardPayment.findMany({
      where: { accountId: card.id },
    });

    if (allPayments.length === 0) {
      console.log('❌ No hay ningún pago registrado para esta tarjeta\n');
    } else {
      console.log(`📋 Pagos registrados: ${allPayments.length}\n`);
      allPayments.forEach((p, i) => {
        console.log(`Pago ${i + 1}:`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Monto: €${Number(p.amount).toFixed(2)}`);
        console.log(`   periodStart: ${new Date(p.periodStart).toISOString()}`);
        console.log(`   periodEnd: ${new Date(p.periodEnd).toISOString()}`);
        console.log(`   paymentDate: ${new Date(p.paymentDate).toISOString()}`);

        // Compare dates
        const startMatch = new Date(p.periodStart).getTime() === previousCutoff.getTime();
        const endMatch = new Date(p.periodEnd).getTime() === closedPeriodEnd.getTime();

        console.log(`   ¿periodStart coincide? ${startMatch ? '✅' : '❌'}`);
        console.log(`   ¿periodEnd coincide? ${endMatch ? '✅' : '❌'}`);

        if (!startMatch) {
          const diff = new Date(p.periodStart).getTime() - previousCutoff.getTime();
          console.log(`   Diferencia en start: ${diff / 1000 / 60 / 60} horas`);
        }
        if (!endMatch) {
          const diff = new Date(p.periodEnd).getTime() - closedPeriodEnd.getTime();
          console.log(`   Diferencia en end: ${diff / 1000 / 60 / 60} horas`);
        }
        console.log('');
      });
    }
  }
}

debugPaymentExact()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
