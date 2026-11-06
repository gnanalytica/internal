import { redirect } from "next/navigation";

// "This week" is now a tab on the Projects home; kept for old bookmarks.
export default function WeeklyPage() {
  redirect("/projects?tab=week");
}
