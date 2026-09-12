import Link from "next/link";
import { logout } from "@/lib/actions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-base font-semibold text-slate-100">
              投資アナリティクス
            </Link>
            <Link
              href="/portfolio"
              className="text-sm text-slate-400 transition hover:text-slate-100"
            >
              ポートフォリオ
            </Link>
            <Link
              href="/simulator"
              className="text-sm text-slate-400 transition hover:text-slate-100"
            >
              シミュレーター
            </Link>
            <Link
              href="/users"
              className="text-sm text-slate-400 transition hover:text-slate-100"
            >
              ユーザー管理
            </Link>
            <Link
              href="/settings"
              className="text-sm text-slate-400 transition hover:text-slate-100"
            >
              設定
            </Link>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
