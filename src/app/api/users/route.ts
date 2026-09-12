import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { createUser, listUsers, UsernameTakenError } from "@/lib/users";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  try {
    const user = await createUser(username, password);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof UsernameTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "作成に失敗しました。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
