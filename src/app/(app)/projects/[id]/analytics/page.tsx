import { redirect } from "next/navigation";

/**
 * The scorecard is the project's first tab now (labelled "Scorecard"); old
 * links to the Analytics tab land there.
 */
export default async function ProjectAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/projects/${id}`);
}
