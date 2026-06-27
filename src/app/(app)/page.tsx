import { PortfolioView } from "@/components/portfolio-view";
import { getMyRole, getPortfolio, getWorkspace } from "@/lib/data";

export default async function OverviewPage() {
  const ws = await getWorkspace();
  const [rows, role] = await Promise.all([getPortfolio(ws.id), getMyRole(ws.id)]);
  return <PortfolioView rows={rows} bets={ws.bets ?? []} isAdmin={role === "admin"} />;
}
