import { notFound } from "next/navigation";

import { PersonPage } from "@/components/prospects/person-page";
import { getWorkspace } from "@/lib/data";
import { getPersonView, resolveContactId } from "@/lib/sheet-crm/queries";

/** A person: by contact uuid, or by the sheet's person_id (P#####). */
export default async function PersonRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  const contactId = await resolveContactId(ws.id, id);
  if (!contactId) notFound();
  const view = await getPersonView(ws.id, contactId);
  if (!view) notFound();
  return <PersonPage view={view} backHref="/prospects" />;
}
