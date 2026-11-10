import { useQuery } from "@tanstack/react-query";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";

import { ErrorView, Loading } from "@/components/ui";
import { projectQuery } from "@/features/projects/api";
import { CyclesView } from "@/features/projects/cycles-view";
import { hasEngineering } from "@/features/projects/departments";

/**
 * A project's cycles. They are the Cycles view inside Engineering now, so old
 * links (Slack, notifications) land there. A project without Engineering has
 * nowhere to nest them, so this screen still shows them on their own — as the
 * web's /projects/[id]/cycles does.
 */
export default function ProjectCyclesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery(projectQuery(id));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  if (hasEngineering(q.data)) return <Redirect href={{ pathname: "/projects/[id]/engineering", params: { id, tab: "cycles" } }} />;
  return (
    <>
      <Stack.Screen options={{ title: `${q.data.name} · Cycles` }} />
      <CyclesView projectId={id} />
    </>
  );
}
