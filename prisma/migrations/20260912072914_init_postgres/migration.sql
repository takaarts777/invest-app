-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('US_STOCK', 'LEVERAGED_ETF', 'CRYPTO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anthropicApiKeyEncrypted" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatorAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cashJpy" DOUBLE PRECISION NOT NULL DEFAULT 500000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatorPosition" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "providerId" TEXT NOT NULL,
    "displayName" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "avgCostJpy" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SimulatorPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatorTrade" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "usdJpyRate" DOUBLE PRECISION NOT NULL,
    "amountJpy" DOUBLE PRECISION NOT NULL,
    "realizedPnlJpy" DOUBLE PRECISION,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatorTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "displayName" TEXT,
    "providerId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" DOUBLE PRECISION,
    "avgCostUsd" DOUBLE PRECISION,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisSnapshot" (
    "id" TEXT NOT NULL,
    "watchlistItemId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "technicalScore" DOUBLE PRECISION,
    "fundamentalScore" DOUBLE PRECISION,
    "sentimentScore" DOUBLE PRECISION,
    "anomalyScore" DOUBLE PRECISION,
    "smartMoneyScore" DOUBLE PRECISION,
    "compositeScore" DOUBLE PRECISION,
    "compositeLabel" TEXT,
    "divergenceSignal" TEXT,
    "rationale" TEXT,
    "rawDetails" TEXT,

    CONSTRAINT "AnalysisSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatorAccount_userId_key" ON "SimulatorAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatorPosition_accountId_symbol_assetType_key" ON "SimulatorPosition"("accountId", "symbol", "assetType");

-- CreateIndex
CREATE INDEX "SimulatorTrade_accountId_executedAt_idx" ON "SimulatorTrade"("accountId", "executedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_symbol_assetType_key" ON "WatchlistItem"("userId", "symbol", "assetType");

-- CreateIndex
CREATE INDEX "AnalysisSnapshot_watchlistItemId_computedAt_idx" ON "AnalysisSnapshot"("watchlistItemId", "computedAt");

-- AddForeignKey
ALTER TABLE "SimulatorAccount" ADD CONSTRAINT "SimulatorAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatorPosition" ADD CONSTRAINT "SimulatorPosition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SimulatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatorTrade" ADD CONSTRAINT "SimulatorTrade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SimulatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisSnapshot" ADD CONSTRAINT "AnalysisSnapshot_watchlistItemId_fkey" FOREIGN KEY ("watchlistItemId") REFERENCES "WatchlistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
