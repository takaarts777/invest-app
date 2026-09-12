import { redirect } from "next/navigation";
import { userCount } from "@/lib/users";
import { LoginForm } from "@/components/LoginForm";

// The redirect below depends on live DB state (has anyone signed up
// yet?); Prisma reads don't force dynamic rendering the way cookies()/
// headers() do, so without this a build-time snapshot (typically 0
// users) could get baked in as a static page that always redirects to
// /setup even after accounts exist.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // No accounts exist yet — send them to create the first one instead of
  // showing a login form that can never succeed.
  if ((await userCount()) === 0) {
    redirect("/setup");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="mb-1 text-xl font-semibold text-slate-100">
          投資アナリティクス
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          ユーザー名とパスワードを入力してください
        </p>

        <LoginForm />
      </div>
    </div>
  );
}
