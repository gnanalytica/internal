import { redirect } from "next/navigation";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Customer Success moved into Sales: customers (with their onboarding,
 * requests and check-ins) are the Customers tab, and saved answers are a
 * section of the Playbook. Old links land on the same thing there:
 *
 *   ?c=<ref>        → Sales ?tab=customers&c=<ref>
 *   ?tab=requests   → Sales ?tab=customers&cf=requests
 *   ?tab=answers    → Sales ?tab=playbook&pb=answers
 */
export default async function ProjectCustomerSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab = first(sp.tab);
  const q = new URLSearchParams();
  if (tab === "answers") {
    q.set("tab", "playbook");
    q.set("pb", "answers");
  } else {
    q.set("tab", "customers");
    if (tab === "requests") q.set("cf", "requests");
    const c = first(sp.c);
    if (c) q.set("c", c);
  }
  redirect(`/projects/${id}/sales?${q.toString()}`);
}
