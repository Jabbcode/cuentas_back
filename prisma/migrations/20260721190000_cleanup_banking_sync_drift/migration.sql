-- DropForeignKey
ALTER TABLE IF EXISTS "BankConnection" DROP CONSTRAINT IF EXISTS "BankConnection_accountId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "BankConnection" DROP CONSTRAINT IF EXISTS "BankConnection_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Transaction_externalId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Transaction_externalId_key";

-- DropIndex
DROP INDEX IF EXISTS "Transaction_source_idx";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "bankMetadata",
DROP COLUMN IF EXISTS "externalId",
DROP COLUMN IF EXISTS "source";

-- DropTable
DROP TABLE IF EXISTS "BankConnection";

-- DropTable
DROP TABLE IF EXISTS "OAuthState";

-- DropTable
DROP TABLE IF EXISTS "PendingBankAuth";
