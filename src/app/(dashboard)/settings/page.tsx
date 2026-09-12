import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { hasAnthropicApiKey } from "@/lib/users";
import { AnthropicKeyForm } from "@/components/AnthropicKeyForm";

// Reads per-request DB state (this user's key status) — force dynamic so
// Next doesn't bake in a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const isSet = await hasAnthropicApiKey(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">設定</h1>
        <p className="mt-1 text-sm text-slate-400">
          ここでの設定はあなた自身のアカウントにのみ適用され、他のユーザーには影響しません。
        </p>
      </div>

      <AnthropicKeyForm initialIsSet={isSet} />
    </div>
  );
}
