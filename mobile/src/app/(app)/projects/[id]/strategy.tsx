import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { Button, Empty, ErrorView, Loading, Screen } from "@/components/ui";
import { strategyQuery } from "@/features/business/api";
import { FormSheet } from "@/features/business/form-sheet";
import { DeptScaffold } from "@/features/business/scaffold";
import { PathToScale, type SheetSpec } from "@/features/business/strategy/path-to-scale";
import { Scorecard } from "@/features/business/strategy/scorecard";
import { run } from "@/features/business/strategy/shared";
import { Backdrop, Initiatives, Traction, UnitEconomics } from "@/features/business/strategy/traction";
import { Restricted } from "@/features/business/ui";

/** A project's strategy, section by section as on the web, with the same edits. */
export default function StrategyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery(strategyQuery(id));
  const [sheet, setSheet] = useState<SheetSpec | null>(null);
  const [seeding, setSeeding] = useState(false);

  const body = (() => {
    if (q.isPending) return <Loading />;
    if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
    const s = q.data;
    if (!s.enabled) return <Restricted icon="compass" title="Strategy isn't turned on for this project" body="An admin can turn the Strategy department on in the project's settings on the web." />;
    if (!s.view)
      return (
        <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
          <Empty
            icon="compass"
            title="No strategy yet"
            body="Start from a blank frame: three stage gates, empty Desirability · Feasibility · Viability pillars and no content. You fill in the rest."
            action={
              <Button
                title="Start the strategy"
                variant="brand"
                loading={seeding}
                style={{ marginTop: 12 }}
                onPress={async () => {
                  setSeeding(true);
                  try {
                    await run(id, { op: "seedTemplate" });
                  } catch (e) {
                    Alert.alert("Couldn't start it", (e as Error).message);
                  } finally {
                    setSeeding(false);
                  }
                }}
              />
            }
          />
        </Screen>
      );
    const v = s.view;
    return (
      <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        <PathToScale projectId={id} view={v} edit={setSheet} />
        <Scorecard projectId={id} view={v} milestones={s.milestones} edit={setSheet} />
        <Initiatives projectId={id} view={v} milestones={s.milestones} edit={setSheet} />
        <Traction projectId={id} view={v} edit={setSheet} />
        <UnitEconomics view={v} />
        <Backdrop projectId={id} view={v} edit={setSheet} />
      </Screen>
    );
  })();

  return (
    <DeptScaffold title="Strategy" projectId={id}>
      {body}
      {sheet ? (
        <FormSheet
          visible
          onClose={() => setSheet(null)}
          title={sheet.title}
          fields={sheet.fields}
          initial={sheet.initial}
          submitLabel={sheet.submitLabel}
          onSubmit={sheet.submit}
          onDelete={sheet.onDelete}
          deleteLabel={sheet.deleteLabel}
        />
      ) : null}
    </DeptScaffold>
  );
}
