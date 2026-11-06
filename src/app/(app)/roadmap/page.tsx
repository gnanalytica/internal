import { redirect } from "next/navigation";

// The roadmap is now the Timeline tab on the Projects home; kept for old bookmarks.
export default function RoadmapPage() {
  redirect("/projects?tab=timeline");
}
