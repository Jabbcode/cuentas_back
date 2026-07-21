-- DropForeignKey
ALTER TABLE "BankConnection" DROP CONSTRAINT "BankConnection_accountId_fkey";

-- DropForeignKey
ALTER TABLE "BankConnection" DROP CONSTRAINT "BankConnection_userId_fkey";

-- DropIndex
DROP INDEX "Transaction_externalId_idx";

-- DropIndex
DROP INDEX "Transaction_externalId_key";

-- DropIndex
DROP INDEX "Transaction_source_idx";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "bankMetadata",
DROP COLUMN "externalId",
DROP COLUMN "source";

-- DropTable
DROP TABLE "BankConnection";

-- DropTable
DROP TABLE "OAuthState";

-- DropTable
DROP TABLE "PendingBankAuth";
