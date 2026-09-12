import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { listUsers } from "@/lib/users";
import { UserManagement } from "@/components/UserManagement";

export default async function UsersPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const users = await listUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">ユーザー管理</h1>
        <p className="mt-1 text-sm text-slate-400">
          各ユーザーは完全に独立したウォッチリスト・ポートフォリオを持ちます。ユーザーを削除すると、そのユーザーのデータも全て削除されます。
        </p>
      </div>

      <UserManagement
        initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        currentUserId={userId}
      />
    </div>
  );
}
