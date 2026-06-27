import { redirect } from "next/navigation";

// Cycles are project-scoped (each project's Engineering → Cycles). The company
// view is the Weekly rollup, so the old standalone list redirects there.
export default function CyclesPage() {
  redirect("/weekly");
}
