import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { getRatePredictor } from "@/lib/rate-predictor";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getRatePredictor();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "取得に失敗しました。";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
