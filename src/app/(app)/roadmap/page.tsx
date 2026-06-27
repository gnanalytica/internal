import { redirect } from "next/navigation";

// The roadmap is now the Timeline tab on the Projects home.
export default function RoadmapPage() {
  redirect("/projects");
}
