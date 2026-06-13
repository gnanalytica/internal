import { notFound } from "next/navigation";

import { DatabaseView } from "@/components/database-view";
import { getDatabase, getMyRole, getWorkspace } from "@/lib/data";

export default async function DatabaseRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const database = await getDatabase(ws.id, id);
  if (!database) notFound();
  const role = await getMyRole(ws.id);
  return <DatabaseView database={database} isAdmin={role === "admin"} />;
}
