import { redirect } from "next/navigation";
import { userCount } from "@/lib/users";
import { getSessionUserId } from "@/lib/session";
import { LoginForm } from "@/components/LoginForm";

// The redirects below depend on live DB state (has anyone signed up
// yet? is the current session's user still real?); Prisma reads don't
// force dynamic rendering the way cookies()/headers() do, so without
// this a build-time snapshot could get baked in as a static page.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // No accounts exist yet — send them to create the first one instead of
  // showing a login form that can never succeed.
  if ((await userCount()) === 0) {
    redirect("/setup");
  }

  // Already logged in with a session that's still valid (getSessionUserId
  // confirms the user actually still exists in the DB, unlike proxy.ts's
  // shape-only check) — skip the form. A stale cookie for a deleted/reset
  // user falls through to render the form below instead of bouncing back
  // and forth with proxy.ts.
  if (await getSessionUserId()) {
    redirect("/");
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
