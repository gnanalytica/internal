/** Roll up a feature's linked issues into done/total/pct. Canceled issues are
 * excluded from the total; done counts completed work. Pure — easy to test. */
export function featureProgress(
  issues: { status: string }[],
): { done: number; total: number; pct: number } {
  const counted = issues.filter((i) => i.status !== "canceled");
  const done = counted.filter((i) => i.status === "done").length;
  const total = counted.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}
