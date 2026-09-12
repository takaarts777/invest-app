"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UserRow = { id: string; username: string; createdAt: string };

export function UserManagement({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "作成に失敗しました。");
        return;
      }
      setUsers((prev) => [...prev, data.user]);
      setUsername("");
      setPassword("");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`ユーザー「${name}」を削除しますか？そのユーザーのウォッチリスト・ポートフォリオも全て削除されます。`)) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "削除に失敗しました。");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="mb-1 block text-xs text-slate-400" htmlFor="new-username">
            ユーザー名
          </label>
          <input
            id="new-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-slate-400" htmlFor="new-password">
            パスワード(8文字以上)
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          {pending ? "追加中..." : "ユーザーを追加"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4"
          >
            <div>
              <span className="font-medium text-slate-100">{u.username}</span>
              {u.id === currentUserId && (
                <span className="ml-2 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">
                  ログイン中
                </span>
              )}
              <p className="text-xs text-slate-500">
                {new Date(u.createdAt).toLocaleDateString("ja-JP")} 作成
              </p>
            </div>
            {u.id !== currentUserId && (
              <button
                onClick={() => handleDelete(u.id, u.username)}
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-800 hover:text-red-400"
                aria-label={`${u.username}を削除`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
