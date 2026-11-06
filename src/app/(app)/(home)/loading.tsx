import { HomeSkeleton } from "@/components/page-skeleton";

// The home page sits in its own route group so this boundary covers `/` only.
// A loading.tsx directly under (app) would wrap every route in the app and show
// the home's skeleton on the way to, say, Settings.
export default function Loading() {
  return <HomeSkeleton />;
}
