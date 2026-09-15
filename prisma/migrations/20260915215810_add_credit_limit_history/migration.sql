-- CreateTable
CREATE TABLE "CreditLimitHistory" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "creditLimit" DECIMAL(65,30) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLimitHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditLimitHistory_accountId_effectiveFrom_idx" ON "CreditLimitHistory"("accountId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "CreditLimitHistory" ADD CONSTRAINT "CreditLimitHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: una fila de historial por cada tarjeta de crédito con límite
-- configurado, usando Account."createdAt" como effectiveFrom. Es una fecha
-- arbitraria pero anterior a todo período posible de esa cuenta, que es lo
-- único que importa: garantiza que cualquier período cerrado antes de este
-- deploy resuelva contra esta fila en vez de mutar con cambios futuros de
-- límite (criterio 3 de la spec credit-card-period-limits).
INSERT INTO "CreditLimitHistory" ("id", "accountId", "creditLimit", "effectiveFrom", "createdAt")
SELECT gen_random_uuid(), "id", "creditLimit", "createdAt", CURRENT_TIMESTAMP
FROM "Account"
WHERE "type" = 'credit_card' AND "creditLimit" IS NOT NULL;
