import { redirect } from "next/navigation";

// Cycles are project-scoped (each project's Engineering → Cycles); the
// cross-project view is the Projects → This Week tab.
export default function CyclesPage() {
  redirect("/projects");
}
