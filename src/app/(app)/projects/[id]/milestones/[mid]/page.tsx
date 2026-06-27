import { notFound } from "next/navigation";

import { MilestoneDetailView } from "@/components/milestone-detail";
import { getMilestone, getWorkspace } from "@/lib/data";

export default async function MilestoneDetailPage({
  params,
}: {
  params: Promise<{ id: string; mid: string }>;
}) {
  const { mid } = await params;
  const ws = await getWorkspace();
  const milestone = await getMilestone(ws.id, mid);
  if (!milestone) notFound();
  return <MilestoneDetailView milestone={milestone} />;
}
