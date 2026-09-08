"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function HoldingForm({
  itemId,
  initialQuantity,
  initialAvgCostUsd,
}: {
  itemId: string;
  initialQuantity: number | null;
  initialAvgCostUsd: number | null;
}) {
  const router = useRouter();
  const hasHolding = initialQuantity !== null;

  const [quantity, setQuantity] = useState(initialQuantity?.toString() ?? "");
  const [avgCostUsd, setAvgCostUsd] = useState(initialAvgCostUsd?.toString() ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: { quantity: number | null; avgCostUsd: number | null }) {
    const res = await fetch(`/api/watchlist/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "更新に失敗しました。");
    return data;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const q = parseFloat(quantity);
      const c = parseFloat(avgCostUsd);
      if (!Number.isFinite(q) || !Number.isFinite(c) || q <= 0 || c <= 0) {
        setError("数量・平均取得単価には正の数を入力してください。");
        return;
      }
      await patch({ quantity: q, avgCostUsd: c });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  async function handleClear() {
    if (!confirm("保有情報を削除しますか？（ウォッチリストからは削除されません）")) return;
    setPending(true);
    setError(null);
    try {
      await patch({ quantity: null, avgCostUsd: null });
      setQuantity("");
      setAvgCostUsd("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">保有情報</h3>
      <p className="mb-3 text-xs text-slate-500">
        数量・平均取得単価(USD)を登録すると、ポートフォリオページに反映されます。
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-slate-400" htmlFor="quantity">
            数量
          </label>
          <input
            id="quantity"
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="例: 10"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-xs text-slate-400" htmlFor="avgCostUsd">
            平均取得単価 (USD)
          </label>
          <input
            id="avgCostUsd"
            type="number"
            step="any"
            min="0"
            value={avgCostUsd}
            onChange={(e) => setAvgCostUsd(e.target.value)}
            placeholder="例: 150.00"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          {pending ? "保存中..." : hasHolding ? "更新" : "保有として登録"}
        </button>

        {hasHolding && (
          <button
            type="button"
            onClick={handleClear}
            disabled={pending}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-red-400 disabled:opacity-50"
          >
            削除
          </button>
        )}
      </form>

      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
