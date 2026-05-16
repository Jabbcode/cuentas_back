-- AlterTable Transaction: add banking sync fields
ALTER TABLE "Transaction" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Transaction" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "bankMetadata" JSONB;

-- CreateIndex for Transaction source and externalId
CREATE INDEX "Transaction_source_idx" ON "Transaction"("source");
CREATE UNIQUE INDEX "Transaction_externalId_key" ON "Transaction"("externalId");
CREATE INDEX "Transaction_externalId_idx" ON "Transaction"("externalId");

-- CreateTable OAuthState
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex OAuthState
CREATE INDEX "OAuthState_userId_idx" ON "OAuthState"("userId");

-- CreateTable PendingBankAuth
CREATE TABLE "PendingBankAuth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "truelayerAccounts" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingBankAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex PendingBankAuth
CREATE INDEX "PendingBankAuth_userId_idx" ON "PendingBankAuth"("userId");

-- CreateTable BankConnection
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'truelayer',
    "truelayerAccountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex BankConnection
CREATE UNIQUE INDEX "BankConnection_userId_truelayerAccountId_key" ON "BankConnection"("userId", "truelayerAccountId");
CREATE INDEX "BankConnection_userId_idx" ON "BankConnection"("userId");
CREATE INDEX "BankConnection_userId_isActive_idx" ON "BankConnection"("userId", "isActive");
CREATE INDEX "BankConnection_accountId_idx" ON "BankConnection"("accountId");

-- AddForeignKey BankConnection -> User
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey BankConnection -> Account
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
