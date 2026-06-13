import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // If already signed in, skip the auth screens.
  const { data: session } = await auth.getSession();
  if (session?.user) redirect("/issues");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 px-4">
      {/* Subtle brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--brand), transparent 70%)" }}
      />
      <div className="relative w-full max-w-sm rounded-2xl border bg-background p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
