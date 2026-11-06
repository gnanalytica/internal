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
  const [milestone, ctx] = await Promise.all([getMilestone(ws.id, mid), getTaskContext(ws.id)]);
  if (!milestone) notFound();
  return <MilestoneDetailView milestone={milestone} ctx={ctx} />;
}
