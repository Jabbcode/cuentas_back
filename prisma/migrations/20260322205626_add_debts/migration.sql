-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditor" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "remainingAmount" DECIMAL(65,30) NOT NULL,
    "interestRate" DECIMAL(65,30),
    "interestType" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "principal" DECIMAL(65,30) NOT NULL,
    "interest" DECIMAL(65,30) NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionId" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Debt_userId_idx" ON "Debt"("userId");

-- CreateIndex
CREATE INDEX "Debt_userId_status_idx" ON "Debt"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPayment_transactionId_key" ON "DebtPayment"("transactionId");

-- CreateIndex
CREATE INDEX "DebtPayment_debtId_idx" ON "DebtPayment"("debtId");

-- CreateIndex
CREATE INDEX "DebtPayment_userId_idx" ON "DebtPayment"("userId");

-- CreateIndex
CREATE INDEX "DebtPayment_paymentDate_idx" ON "DebtPayment"("paymentDate");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
