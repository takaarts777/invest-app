import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getSimulatorSummary } from "@/lib/simulator";
import { SimulatorDashboard } from "@/components/SimulatorDashboard";

// Reads live prices/forex plus per-user DB state on every request — force
// dynamic rendering so Next doesn't bake in a build-time snapshot (same
// reasoning as the portfolio page).
export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const summary = await getSimulatorSummary(userId);

  return <SimulatorDashboard initialSummary={summary} />;
}
