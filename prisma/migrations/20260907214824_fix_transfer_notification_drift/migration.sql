-- Corrective migration: captures schema drift introduced by `prisma db push`
-- (Transfer, Notification, and related columns were never recorded as migrations).
-- On environments that already have this drift (dev, and possibly others),
-- resolve this migration as applied instead of running it:
--   npx dotenv -e <env-file> -- npx prisma migrate resolve --applied 20260907214824_fix_transfer_notification_drift

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "paymentAccountId" TEXT;

-- AlterTable
ALTER TABLE "FixedExpense" ADD COLUMN     "creditCardAccountId" TEXT,
ADD COLUMN     "recurringDebtPaymentId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationPreferences" JSONB NOT NULL DEFAULT '{"categoryLimit":true,"debtDue":true,"monthlyEmail":true}';

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transfer_userId_idx" ON "Transfer"("userId");

-- CreateIndex
CREATE INDEX "Transfer_fromAccountId_idx" ON "Transfer"("fromAccountId");

-- CreateIndex
CREATE INDEX "Transfer_toAccountId_idx" ON "Transfer"("toAccountId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FixedExpense_recurringDebtPaymentId_key" ON "FixedExpense"("recurringDebtPaymentId");

-- CreateIndex
CREATE INDEX "FixedExpense_creditCardAccountId_idx" ON "FixedExpense"("creditCardAccountId");

-- CreateIndex
CREATE INDEX "FixedExpense_recurringDebtPaymentId_idx" ON "FixedExpense"("recurringDebtPaymentId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedExpense" ADD CONSTRAINT "FixedExpense_creditCardAccountId_fkey" FOREIGN KEY ("creditCardAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedExpense" ADD CONSTRAINT "FixedExpense_recurringDebtPaymentId_fkey" FOREIGN KEY ("recurringDebtPaymentId") REFERENCES "RecurringDebtPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
