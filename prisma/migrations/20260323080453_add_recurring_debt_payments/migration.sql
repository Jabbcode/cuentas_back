-- CreateTable
CREATE TABLE "RecurringDebtPayment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "accountId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "lastProcessed" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringDebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringDebtPayment_debtId_idx" ON "RecurringDebtPayment"("debtId");

-- CreateIndex
CREATE INDEX "RecurringDebtPayment_userId_idx" ON "RecurringDebtPayment"("userId");

-- CreateIndex
CREATE INDEX "RecurringDebtPayment_nextDueDate_idx" ON "RecurringDebtPayment"("nextDueDate");

-- CreateIndex
CREATE INDEX "RecurringDebtPayment_isActive_idx" ON "RecurringDebtPayment"("isActive");

-- AddForeignKey
ALTER TABLE "RecurringDebtPayment" ADD CONSTRAINT "RecurringDebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringDebtPayment" ADD CONSTRAINT "RecurringDebtPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringDebtPayment" ADD CONSTRAINT "RecurringDebtPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
