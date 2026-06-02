-- DropForeignKey
ALTER TABLE "Budget" DROP CONSTRAINT IF EXISTS "Budget_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Budget" DROP CONSTRAINT IF EXISTS "Budget_userId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionTag" DROP CONSTRAINT IF EXISTS "TransactionTag_tagId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionTag" DROP CONSTRAINT IF EXISTS "TransactionTag_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "TransactionTag";

-- DropTable
DROP TABLE IF EXISTS "Budget";

-- DropTable
DROP TABLE IF EXISTS "Tag";
