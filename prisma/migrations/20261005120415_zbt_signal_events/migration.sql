-- CreateTable
CREATE TABLE "ZbtSignalEvent" (
    "id" TEXT NOT NULL,
    "signalDate" TEXT NOT NULL,
    "sp500Close" DOUBLE PRECISION NOT NULL,
    "drawdownPct" DOUBLE PRECISION NOT NULL,
    "rsi14" DOUBLE PRECISION NOT NULL,
    "zbtEma" DOUBLE PRECISION NOT NULL,
    "upsidePct" DOUBLE PRECISION NOT NULL,
    "medianRisePct" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "predictedHighClose" DOUBLE PRECISION NOT NULL,
    "predictedHighDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "realizedMaxClose" DOUBLE PRECISION,
    "realizedRisePct" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZbtSignalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZbtSignalEvent_signalDate_key" ON "ZbtSignalEvent"("signalDate");
