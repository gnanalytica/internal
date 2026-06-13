import { notFound } from "next/navigation";

import { DatabaseView } from "@/components/database-view";
import { getDatabase, getWorkspace } from "@/lib/data";

export default async function DatabaseRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const database = await getDatabase(ws.id, id);
  if (!database) notFound();
  return <DatabaseView database={database} />;
}
