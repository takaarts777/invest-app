import { redirect } from "next/navigation";
import { userCount } from "@/lib/users";
import { SetupForm } from "@/components/SetupForm";

// See the comment in app/login/page.tsx — same build-time-snapshot risk.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Only usable before any account exists — once set up, this page steps
  // aside for /login (and for the in-app /users page for adding more).
  if ((await userCount()) > 0) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="mb-1 text-xl font-semibold text-slate-100">
          初期セットアップ
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          最初の管理用アカウントを作成してください。追加のユーザーはログイン後の「ユーザー管理」から登録できます。
        </p>

        <SetupForm />
      </div>
    </div>
  );
}
