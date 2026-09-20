import { notFound } from "next/navigation";

import { PersonPage } from "@/components/prospects/person-page";
import { getCampaigns, getWorkspace } from "@/lib/data";
import { googleStatus } from "@/lib/google/actions";
import { getPersonView, resolveContactId } from "@/lib/sheet-crm/queries";

/** A person: by contact uuid, or by the sheet's person_id (P#####). */
export default async function PersonRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  const contactId = await resolveContactId(ws.id, id);
  if (!contactId) notFound();
  const [view, google, campaigns] = await Promise.all([getPersonView(ws.id, contactId), googleStatus(), getCampaigns(ws.id)]);
  if (!view) notFound();
  return <PersonPage view={view} backHref="/prospects" google={{ connected: google.connected }} campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))} />;
}
