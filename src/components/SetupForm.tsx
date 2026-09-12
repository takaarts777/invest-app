"use client";

import { useActionState } from "react";
import { createFirstUser } from "@/app/setup/actions";

export function SetupForm() {
  const [state, formAction, pending] = useActionState(createFirstUser, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="username" className="sr-only">
          ユーザー名
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoFocus
          required
          autoComplete="username"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
          placeholder="ユーザー名"
        />
      </div>

      <div>
        <label htmlFor="password" className="sr-only">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
          placeholder="パスワード(8文字以上)"
        />
      </div>

      <div>
        <label htmlFor="passwordConfirm" className="sr-only">
          パスワード(確認)
        </label>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
          placeholder="パスワード(確認)"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-sky-600 px-3 py-2 font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {pending ? "作成中..." : "アカウントを作成"}
      </button>
    </form>
  );
}
