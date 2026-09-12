import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSimulatorSummary } from "@/lib/simulator";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await getSimulatorSummary(userId);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "取得に失敗しました。";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
