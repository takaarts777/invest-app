-- CreateTable
CREATE TABLE "SimulatorAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cashJpy" REAL NOT NULL DEFAULT 500000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SimulatorAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SimulatorPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "displayName" TEXT,
    "quantity" REAL NOT NULL,
    "avgCostJpy" REAL NOT NULL,
    CONSTRAINT "SimulatorPosition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SimulatorAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SimulatorTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "priceUsd" REAL NOT NULL,
    "usdJpyRate" REAL NOT NULL,
    "amountJpy" REAL NOT NULL,
    "realizedPnlJpy" REAL,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SimulatorTrade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SimulatorAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SimulatorAccount_userId_key" ON "SimulatorAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatorPosition_accountId_symbol_assetType_key" ON "SimulatorPosition"("accountId", "symbol", "assetType");

-- CreateIndex
CREATE INDEX "SimulatorTrade_accountId_executedAt_idx" ON "SimulatorTrade"("accountId", "executedAt");
