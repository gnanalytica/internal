import { notFound } from "next/navigation";

import { FeatureDetailView } from "@/components/feature-detail";
import { getFeature, getMembers, getPagesFlat, getWorkspace } from "@/lib/data";

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ id: string; fid: string }>;
}) {
  const { fid } = await params;
  const ws = await getWorkspace();
  const [feature, members, pages] = await Promise.all([
    getFeature(ws.id, fid),
    getMembers(ws.id),
    getPagesFlat(ws.id),
  ]);
  if (!feature) notFound();
  return <FeatureDetailView feature={feature} members={members} pages={pages} />;
}
