import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resetAccount, getSimulatorSummary } from "@/lib/simulator";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await resetAccount(userId);
  const summary = await getSimulatorSummary(userId);
  return NextResponse.json({ summary });
}
