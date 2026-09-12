-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "displayName" TEXT,
    "providerId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" REAL,
    "avgCostUsd" REAL,
    CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalysisSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "watchlistItemId" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "technicalScore" REAL,
    "fundamentalScore" REAL,
    "sentimentScore" REAL,
    "anomalyScore" REAL,
    "smartMoneyScore" REAL,
    "compositeScore" REAL,
    "compositeLabel" TEXT,
    "divergenceSignal" TEXT,
    "rationale" TEXT,
    "rawDetails" TEXT,
    CONSTRAINT "AnalysisSnapshot_watchlistItemId_fkey" FOREIGN KEY ("watchlistItemId") REFERENCES "WatchlistItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_symbol_assetType_key" ON "WatchlistItem"("userId", "symbol", "assetType");

-- CreateIndex
CREATE INDEX "AnalysisSnapshot_watchlistItemId_computedAt_idx" ON "AnalysisSnapshot"("watchlistItemId", "computedAt");
