import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { deleteUser } from "@/lib/users";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/users/[id]">
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  if (id === userId) {
    return NextResponse.json(
      { error: "ログイン中の自分自身のアカウントは削除できません。" },
      { status: 400 }
    );
  }

  try {
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました。" }, { status: 400 });
  }
}
