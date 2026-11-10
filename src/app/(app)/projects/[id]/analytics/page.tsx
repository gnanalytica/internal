import { redirect } from "next/navigation";

/**
 * The scorecard moved to the top of the project's Overview; old links to the
 * Analytics tab land there.
 */
export default async function ProjectAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/projects/${id}`);
}
