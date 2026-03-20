-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "creditLimit" DECIMAL(65,30),
ADD COLUMN     "cutoffDay" INTEGER,
ADD COLUMN     "paymentDueDay" INTEGER;

-- CreateTable
CREATE TABLE "CreditCardPayment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCardPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardPayment_transactionId_key" ON "CreditCardPayment"("transactionId");

-- CreateIndex
CREATE INDEX "CreditCardPayment_accountId_idx" ON "CreditCardPayment"("accountId");

-- CreateIndex
CREATE INDEX "CreditCardPayment_paymentDate_idx" ON "CreditCardPayment"("paymentDate");

-- AddForeignKey
ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
