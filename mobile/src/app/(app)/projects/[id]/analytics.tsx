import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * The scorecard moved to the top of the project's first screen, as on the web;
 * old links to Analytics (Slack, notifications) land there.
 */
export default function AnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: "/projects/[id]", params: { id } }} />;
}
