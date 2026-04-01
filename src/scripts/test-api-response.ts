import { PrismaClient } from '@prisma/client';
import { getCreditCardStatement } from '../services/credit-cards.service.js';

const prisma = new PrismaClient();

async function testApiResponse() {
  console.log('🧪 Probando respuesta del servicio como si fuera el API...\n');

  // Get user and card
  const user = await prisma.user.findUnique({
    where: { email: 'jbriosob@gmail.com' },
  });

  if (!user) {
    console.log('❌ Usuario no encontrado');
    return;
  }

  const card = await prisma.account.findFirst({
    where: {
      name: 'Imagin - Credito',
      type: 'credit_card',
      userId: user.id,
    },
  });

  if (!card) {
    console.log('❌ Tarjeta no encontrada');
    return;
  }

  console.log(`👤 Usuario: ${user.email}`);
  console.log(`💳 Tarjeta: ${card.name}\n`);
  console.log('📡 Llamando a getCreditCardStatement()...\n');

  try {
    const statement = await getCreditCardStatement(card.id, user.id);

    console.log('✅ Respuesta del servicio:\n');
    console.log('═'.repeat(60));
    console.log('PERÍODO CERRADO:');
    console.log('═'.repeat(60));
    console.log(`Inicio: ${new Date(statement.closedPeriod.startDate).toLocaleDateString()}`);
    console.log(`Fin: ${new Date(statement.closedPeriod.endDate).toLocaleDateString()}`);
    console.log(`Balance: €${statement.closedPeriod.balance.toFixed(2)}`);
    console.log(`¿Está pagado? ${statement.closedPeriod.isPaid ? '✅ SÍ' : '❌ NO'}`);
    console.log(`Fecha límite de pago: ${new Date(statement.closedPeriod.paymentDueDate).toLocaleDateString()}`);
    console.log(`Días hasta vencimiento: ${statement.closedPeriod.daysUntilDue}`);
    console.log(`Transacciones: ${statement.closedPeriod.transactions.length}`);

    console.log('\n═'.repeat(60));
    console.log('PERÍODO ACTUAL:');
    console.log('═'.repeat(60));
    console.log(`Inicio: ${new Date(statement.currentPeriod.startDate).toLocaleDateString()}`);
    console.log(`Fin: ${new Date(statement.currentPeriod.endDate).toLocaleDateString()}`);
    console.log(`Balance: €${statement.currentPeriod.balance.toFixed(2)}`);
    console.log(`Días hasta corte: ${statement.currentPeriod.daysUntilCutoff}`);
    console.log(`Transacciones: ${statement.currentPeriod.transactions.length}`);

    console.log('\n═'.repeat(60));
    console.log('RESUMEN:');
    console.log('═'.repeat(60));
    console.log(`Límite de crédito: €${statement.creditLimit.toFixed(2)}`);
    console.log(`Disponible: €${statement.available.toFixed(2)}`);
    console.log(`Uso: ${statement.usagePercentage}%`);
    console.log(`Alertas: ${statement.alerts.length}`);

    if (statement.alerts.length > 0) {
      console.log('\n⚠️  Alertas:');
      statement.alerts.forEach((alert, i) => {
        console.log(`   ${i + 1}. [${alert.severity}] ${alert.message}`);
      });
    }

    console.log('\n═'.repeat(60));
    if (statement.closedPeriod.isPaid) {
      console.log('✅ EL PERÍODO CERRADO ESTÁ MARCADO COMO PAGADO');
    } else {
      console.log('❌ EL PERÍODO CERRADO NO ESTÁ MARCADO COMO PAGADO');
      console.log('\n⚠️  Esto es un error porque el pago existe en la BD');
    }
    console.log('═'.repeat(60));

  } catch (error: any) {
    console.error('❌ Error al llamar al servicio:');
    console.error(error.message);
    console.error(error.stack);
  }
}

testApiResponse()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
