import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components gives us `use cache` / `cacheTag` / `cacheLife` in the data
  // layer (src/lib/data.ts), which is what we actually want here. It also turns
  // on PPR, but see the Suspense boundary in src/app/layout.tsx: every route in
  // this app is behind auth and reads the session, so there is no meaningful
  // static shell to prerender.
  cacheComponents: true,
};

export default nextConfig;
