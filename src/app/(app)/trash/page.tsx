import { TrashView } from "@/components/trash-view";
import { getTrashedPages, getWorkspace } from "@/lib/data";

export default async function TrashPage() {
  const ws = await getWorkspace();
  const pages = await getTrashedPages(ws.id);
  return <TrashView pages={pages} />;
}
