import { redirect } from "next/navigation";

// "This week" is now a tab on the Projects home.
export default function WeeklyPage() {
  redirect("/projects");
}
