"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ASSET_TYPES = [
  { value: "US_STOCK", label: "米国株" },
  { value: "LEVERAGED_ETF", label: "レバレッジETF" },
  { value: "CRYPTO", label: "暗号資産" },
] as const;

export function AddTickerForm() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [assetType, setAssetType] =
    useState<(typeof ASSET_TYPES)[number]["value"]>("US_STOCK");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, assetType }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "追加に失敗しました。");
        return;
      }

      setSymbol("");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs text-slate-400" htmlFor="symbol">
          銘柄コード
        </label>
        <input
          id="symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="例: AAPL, TQQQ, BTC"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-400" htmlFor="assetType">
          種別
        </label>
        <select
          id="assetType"
          value={assetType}
          onChange={(e) =>
            setAssetType(e.target.value as typeof assetType)
          }
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 sm:w-auto"
        >
          {ASSET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {pending ? "追加中..." : "追加"}
      </button>

      {error && (
        <p className="text-sm text-red-400 sm:basis-full" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
