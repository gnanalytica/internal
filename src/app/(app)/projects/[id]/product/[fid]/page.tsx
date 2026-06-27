import { notFound } from "next/navigation";

import { FeatureDetailView } from "@/components/feature-detail";
import {
  getFeature,
  getMembers,
  getMilestones,
  getPagesFlat,
  getWorkspace,
} from "@/lib/data";

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ id: string; fid: string }>;
}) {
  const { id, fid } = await params;
  const ws = await getWorkspace();
  const [feature, members, pages, milestones] = await Promise.all([
    getFeature(ws.id, fid),
    getMembers(ws.id),
    getPagesFlat(ws.id),
    getMilestones(ws.id, id),
  ]);
  if (!feature) notFound();
  return (
    <FeatureDetailView
      feature={feature}
      members={members}
      pages={pages}
      milestones={milestones}
    />
  );
}
