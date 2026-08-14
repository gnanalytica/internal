import { notFound } from "next/navigation";

import { FeatureDetailView } from "@/components/feature-detail";
import {
  getFeature,
  getMembers,
  getMilestones,
  getPagesFlat,
  getWorkspace,
} from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ id: string; fid: string }>;
}) {
  const { id, fid } = await params;
  const ws = await getWorkspace();
  const [feature, members, pages, milestones, ctx] = await Promise.all([
    getFeature(ws.id, fid),
    getMembers(ws.id),
    getPagesFlat(ws.id),
    getMilestones(ws.id, id),
    getTaskContext(ws.id),
  ]);
  if (!feature) notFound();
  return (
    <FeatureDetailView
      feature={feature}
      members={members}
      pages={pages}
      milestones={milestones}
      ctx={ctx}
    />
  );
}
