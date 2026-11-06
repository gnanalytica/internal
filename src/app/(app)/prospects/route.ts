import { redirect } from "next/navigation";

import { getProjects, getWorkspace } from "@/lib/data";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";

/**
 * `/prospects` is a short link: prospects are Valytica's Sales tab, so this
 * lands there with any view, list or record in the query string kept. A
 * workspace without Valytica gets the prospects workspace on its own.
 *
 * A Route Handler rather than a page: route handlers don't render layouts, so
 * the redirect no longer waits on the whole `(app)` shell (sidebar, page tree,
 * favourites, unread count) just to throw it away. The app links straight to
 * the Sales tab; this stays for bookmarks and older links.
 */
export async function GET(req: Request) {
  const ws = await getWorkspace();
  const product = (await getProjects(ws.id)).find((p) => p.key === PROSPECTS_PRODUCT_KEY);
  // The first value per key, as the page this replaced passed them on.
  const params = new URLSearchParams();
  for (const [k, v] of new URL(req.url).searchParams) if (!params.has(k)) params.set(k, v);
  const qs = params.toString();
  redirect(`${product ? `/projects/${product.id}/sales` : "/prospects/workspace"}${qs ? `?${qs}` : ""}`);
}
