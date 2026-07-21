-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "systemKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_systemKey_key" ON "Category"("userId", "systemKey");
