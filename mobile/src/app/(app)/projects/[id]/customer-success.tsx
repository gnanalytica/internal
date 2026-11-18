import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Customer Success moved into Sales, as on the web: customers and their
 * requests are Sales → Customers, and saved answers are part of the Playbook.
 * Old links (Slack, notifications) land on the same thing there:
 *
 *   ?tab=requests → Sales ?tab=customers&cf=requests
 *   ?tab=answers  → Sales ?tab=playbook
 */
export default function CustomerSuccessScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const params: Record<string, string> = tab === "answers" ? { id, tab: "playbook" } : tab === "requests" ? { id, tab: "customers", cf: "requests" } : { id, tab: "customers" };
  return <Redirect href={{ pathname: "/projects/[id]/sales", params }} />;
}
