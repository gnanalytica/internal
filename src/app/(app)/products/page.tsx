import { redirect } from "next/navigation";

// The products hub and the projects list were merged into one Projects page.
export default function ProductsPage() {
  redirect("/projects");
}
