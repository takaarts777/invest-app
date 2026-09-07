-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "displayName" TEXT,
    "providerId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    "compositeScore" REAL,
    "compositeLabel" TEXT,
    "rationale" TEXT,
    "rawDetails" TEXT,
    CONSTRAINT "AnalysisSnapshot_watchlistItemId_fkey" FOREIGN KEY ("watchlistItemId") REFERENCES "WatchlistItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_symbol_assetType_key" ON "WatchlistItem"("symbol", "assetType");

-- CreateIndex
CREATE INDEX "AnalysisSnapshot_watchlistItemId_computedAt_idx" ON "AnalysisSnapshot"("watchlistItemId", "computedAt");
