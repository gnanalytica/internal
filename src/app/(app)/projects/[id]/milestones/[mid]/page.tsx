import { notFound } from "next/navigation";

import { MilestoneDetailView } from "@/components/milestone-detail";
import { getMilestone, getWorkspace } from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";

export default async function MilestoneDetailPage({
  params,
}: {
  params: Promise<{ id: string; mid: string }>;
}) {
  const { mid } = await params;
  const ws = await getWorkspace();
  const milestone = await getMilestone(ws.id, mid);
  if (!milestone) notFound();
  const ctx = await getTaskContext(ws.id);
  return <MilestoneDetailView milestone={milestone} ctx={ctx} />;
}
