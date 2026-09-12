import "server-only";

import { prisma } from "@/lib/db";
import type { AssetType, SimulatorPosition, SimulatorTrade } from "@prisma/client";
import { resolveSymbol, fetchPriceDataFor } from "@/lib/market";
import { fetchUsdJpyRate } from "@/lib/providers/forex";
import { STARTING_CASH_JPY } from "@/lib/simulator-constants";

export { STARTING_CASH_JPY };

export class InsufficientFundsError extends Error {
  constructor() {
    super("ポイント残高が不足しています。");
    this.name = "InsufficientFundsError";
  }
}

export class InsufficientHoldingsError extends Error {
  constructor() {
    super("保有数量が不足しています。");
    this.name = "InsufficientHoldingsError";
  }
}

/** Gets (or lazily creates) the user's paper-trading account. Every user
 *  gets exactly one, seeded with STARTING_CASH_JPY. */
async function getOrCreateAccount(userId: string) {
  const existing = await prisma.simulatorAccount.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.simulatorAccount.create({ data: { userId } });
}

export type PositionWithMarketData = SimulatorPosition & {
  currentPriceUsd: number | null;
  currentValueJpy: number | null;
  unrealizedPnlJpy: number | null;
  unrealizedPnlPercent: number | null;
};

export type SimulatorSummary = {
  cashJpy: number;
  positions: PositionWithMarketData[];
  totalPositionsValueJpy: number;
  totalValueJpy: number;
  totalPnlJpy: number;
  totalPnlPercent: number;
  realizedPnlJpy: number;
  unrealizedPnlJpy: number;
  usdJpyRate: number | null;
  trades: SimulatorTrade[];
};

/** Full account state, with live current prices for every open position. */
export async function getSimulatorSummary(userId: string): Promise<SimulatorSummary> {
  const account = await getOrCreateAccount(userId);

  const [positions, trades, usdJpyRate] = await Promise.all([
    prisma.simulatorPosition.findMany({ where: { accountId: account.id } }),
    prisma.simulatorTrade.findMany({
      where: { accountId: account.id },
      orderBy: { executedAt: "desc" },
      take: 50,
    }),
    fetchUsdJpyRate().catch(() => null),
  ]);

  const priceResults = await Promise.allSettled(
    positions.map((p) => fetchPriceDataFor({ assetType: p.assetType, providerId: p.providerId }))
  );

  const positionsWithMarketData: PositionWithMarketData[] = positions.map((p, i) => {
    const r = priceResults[i];
    const priceUsd = r.status === "fulfilled" ? (r.value.quote?.price ?? null) : null;
    const currentValueJpy =
      priceUsd !== null && usdJpyRate !== null ? p.quantity * priceUsd * usdJpyRate : null;
    const costBasisJpy = p.quantity * p.avgCostJpy;
    const unrealizedPnlJpy = currentValueJpy !== null ? currentValueJpy - costBasisJpy : null;
    const unrealizedPnlPercent =
      unrealizedPnlJpy !== null && costBasisJpy > 0 ? (unrealizedPnlJpy / costBasisJpy) * 100 : null;

    return { ...p, currentPriceUsd: priceUsd, currentValueJpy, unrealizedPnlJpy, unrealizedPnlPercent };
  });

  const totalPositionsValueJpy = positionsWithMarketData.reduce(
    (sum, p) => sum + (p.currentValueJpy ?? 0),
    0
  );
  const unrealizedPnlJpy = positionsWithMarketData.reduce(
    (sum, p) => sum + (p.unrealizedPnlJpy ?? 0),
    0
  );
  const realizedPnlJpy = trades.reduce((sum, t) => sum + (t.realizedPnlJpy ?? 0), 0);

  const totalValueJpy = account.cashJpy + totalPositionsValueJpy;
  const totalPnlJpy = totalValueJpy - STARTING_CASH_JPY;
  const totalPnlPercent = (totalPnlJpy / STARTING_CASH_JPY) * 100;

  return {
    cashJpy: account.cashJpy,
    positions: positionsWithMarketData,
    totalPositionsValueJpy,
    totalValueJpy,
    totalPnlJpy,
    totalPnlPercent,
    realizedPnlJpy,
    unrealizedPnlJpy,
    usdJpyRate,
    trades,
  };
}

export type TradeHint = { providerId: string; displayName: string };

/** Executes a simulated market-price buy: resolves the symbol, prices it
 *  in JPY at the live USD/JPY rate, and — if the account can afford it —
 *  debits cash, upserts the position with a quantity-weighted average
 *  cost, and logs the trade. */
export async function buy(
  userId: string,
  symbol: string,
  assetType: AssetType,
  quantity: number,
  hint?: TradeHint
) {
  if (quantity <= 0) throw new Error("数量は正の数で指定してください。");

  const account = await getOrCreateAccount(userId);
  const trimmed = symbol.trim().toUpperCase();

  const { providerId, displayName } = hint ?? (await resolveSymbol(trimmed, assetType));
  const [priceData, usdJpyRate] = await Promise.all([
    fetchPriceDataFor({ assetType, providerId }),
    fetchUsdJpyRate(),
  ]);
  const priceUsd = priceData.quote?.price;
  if (!priceUsd) throw new Error("現在価格を取得できませんでした。");

  const amountJpy = quantity * priceUsd * usdJpyRate;
  if (amountJpy > account.cashJpy) throw new InsufficientFundsError();

  await prisma.$transaction(async (tx) => {
    await tx.simulatorAccount.update({
      where: { id: account.id },
      data: { cashJpy: account.cashJpy - amountJpy },
    });

    const existing = await tx.simulatorPosition.findUnique({
      where: { accountId_symbol_assetType: { accountId: account.id, symbol: trimmed, assetType } },
    });

    if (existing) {
      const newQuantity = existing.quantity + quantity;
      const newAvgCostJpy =
        (existing.quantity * existing.avgCostJpy + quantity * (amountJpy / quantity)) / newQuantity;
      await tx.simulatorPosition.update({
        where: { id: existing.id },
        data: { quantity: newQuantity, avgCostJpy: newAvgCostJpy },
      });
    } else {
      await tx.simulatorPosition.create({
        data: {
          accountId: account.id,
          symbol: trimmed,
          assetType,
          providerId,
          displayName,
          quantity,
          avgCostJpy: amountJpy / quantity,
        },
      });
    }

    await tx.simulatorTrade.create({
      data: {
        accountId: account.id,
        symbol: trimmed,
        assetType,
        side: "BUY",
        quantity,
        priceUsd,
        usdJpyRate,
        amountJpy,
      },
    });
  });
}

/** Executes a simulated market-price sell against an existing position:
 *  prices it in JPY, credits cash, records the realized P&L against that
 *  position's average cost, and shrinks/closes the position. */
export async function sell(
  userId: string,
  symbol: string,
  assetType: AssetType,
  quantity: number
) {
  if (quantity <= 0) throw new Error("数量は正の数で指定してください。");

  const account = await getOrCreateAccount(userId);
  const trimmed = symbol.trim().toUpperCase();

  const position = await prisma.simulatorPosition.findUnique({
    where: { accountId_symbol_assetType: { accountId: account.id, symbol: trimmed, assetType } },
  });
  if (!position || position.quantity < quantity) throw new InsufficientHoldingsError();

  const [priceData, usdJpyRate] = await Promise.all([
    fetchPriceDataFor({ assetType, providerId: position.providerId }),
    fetchUsdJpyRate(),
  ]);
  const priceUsd = priceData.quote?.price;
  if (!priceUsd) throw new Error("現在価格を取得できませんでした。");

  const amountJpy = quantity * priceUsd * usdJpyRate;
  const realizedPnlJpy = amountJpy - quantity * position.avgCostJpy;
  const remainingQuantity = position.quantity - quantity;

  await prisma.$transaction(async (tx) => {
    await tx.simulatorAccount.update({
      where: { id: account.id },
      data: { cashJpy: account.cashJpy + amountJpy },
    });

    if (remainingQuantity > 0) {
      await tx.simulatorPosition.update({
        where: { id: position.id },
        data: { quantity: remainingQuantity },
      });
    } else {
      await tx.simulatorPosition.delete({ where: { id: position.id } });
    }

    await tx.simulatorTrade.create({
      data: {
        accountId: account.id,
        symbol: trimmed,
        assetType,
        side: "SELL",
        quantity,
        priceUsd,
        usdJpyRate,
        amountJpy,
        realizedPnlJpy,
      },
    });
  });
}

/** Resets the account back to the starting balance and wipes all
 *  positions/trades — a fresh start, not a correction of one trade. */
export async function resetAccount(userId: string) {
  const account = await getOrCreateAccount(userId);
  await prisma.$transaction([
    prisma.simulatorTrade.deleteMany({ where: { accountId: account.id } }),
    prisma.simulatorPosition.deleteMany({ where: { accountId: account.id } }),
    prisma.simulatorAccount.update({
      where: { id: account.id },
      data: { cashJpy: STARTING_CASH_JPY },
    }),
  ]);
}
