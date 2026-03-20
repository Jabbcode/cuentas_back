-- AlterTable
ALTER TABLE "FixedExpense" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "FixedExpense_userId_type_sortOrder_idx" ON "FixedExpense"("userId", "type", "sortOrder");
