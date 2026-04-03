-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "imageHash" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_imageHash_idx" ON "Transaction"("imageHash");
