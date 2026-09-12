"use client";

import { useState } from "react";

export function AnthropicKeyForm({ initialIsSet }: { initialIsSet: boolean }) {
  const [isSet, setIsSet] = useState(initialIsSet);
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/anthropic-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました。");
        return;
      }
      setIsSet(true);
      setApiKey("");
      setNotice("APIキーを保存しました。次回の分析からご自身のAnthropicアカウントで課金されます。");
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  async function handleClear() {
    if (
      !confirm(
        "登録済みのAPIキーを削除しますか？削除後は、再度設定するまでAIによる要約・根拠説明が生成されなくなります。"
      )
    ) {
      return;
    }

    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/anthropic-key", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "削除に失敗しました。");
        return;
      }
      setIsSet(false);
      setNotice("APIキーを削除しました。");
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Anthropic APIキー</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isSet
              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          {isSet ? "設定済み" : "未設定"}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        銘柄分析のニュースセンチメント要約・総合判定の根拠説明はClaude(Anthropic)を使って生成されます。ここにご自身のAPIキーを登録すると、分析を実行するたびの利用料はアプリ管理者ではなく、あなた自身のAnthropicアカウントに請求されます。未設定の場合、これらのAI生成部分は「未設定」の案内に置き換わりますが、それ以外の分析（テクニカル・ファンダメンタル・アノマリー・Smart Money等）は引き続き利用できます。APIキーは
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="text-sky-400 underline hover:text-sky-300"
        >
          Anthropic Console
        </a>
        から取得できます（利用には別途Anthropic側での支払い設定が必要です）。
      </p>

      <form onSubmit={handleSave} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={isSet ? "新しいキーで上書き（sk-ant-...）" : "sk-ant-..."}
          autoComplete="off"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending || !apiKey.trim()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {pending ? "保存中..." : "保存"}
          </button>
          {isSet && (
            <button
              type="button"
              onClick={handleClear}
              disabled={pending}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition hover:border-red-700 hover:text-red-400 disabled:opacity-50"
            >
              削除
            </button>
          )}
        </div>
      </form>

      {notice && (
        <p className="mt-2 text-sm text-emerald-400" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
