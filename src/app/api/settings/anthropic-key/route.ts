import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { hasAnthropicApiKey, setAnthropicApiKey } from "@/lib/users";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSet = await hasAnthropicApiKey(userId);
  return NextResponse.json({ isSet });
}

export async function PUT(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";

  if (!apiKey) {
    return NextResponse.json({ error: "APIキーを入力してください。" }, { status: 400 });
  }
  if (!apiKey.startsWith("sk-ant-")) {
    return NextResponse.json(
      { error: "Anthropic APIキーの形式が正しくないようです（sk-ant- から始まる文字列）。" },
      { status: 400 }
    );
  }

  await setAnthropicApiKey(userId, apiKey);
  return NextResponse.json({ isSet: true });
}

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await setAnthropicApiKey(userId, null);
  return NextResponse.json({ isSet: false });
}
