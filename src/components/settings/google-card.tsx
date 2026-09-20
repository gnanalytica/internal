"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { GoogleIcon } from "@/components/auth/provider-icons";
import { Button } from "@/components/ui/button";
import { disconnectGoogle, ingestGoogleNow } from "@/lib/google/actions";
import { formatDate } from "@/lib/matrix-format";

/** Gmail + Calendar for the outreach timeline. Separate from Google sign-in: different scopes, different grant. */
export function GoogleCard({ status }: { status: { configured: boolean; connected: boolean; email: string | null; syncedAt: Date | null } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start gap-3">
        <GoogleIcon className="mt-0.5 size-5" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Gmail &amp; Calendar for prospects</div>
          <p className="text-xs text-muted-foreground">
            Emails and meetings with people in the Prospects funnel land on their timeline (subject and snippet only), and Draft email / Book a call work from a person&apos;s page. Nothing is ever sent without you.
          </p>
          {status.connected && (
            <p className="mt-1 text-xs text-muted-foreground">
              Connected as {status.email}{status.syncedAt ? ` · last checked ${formatDate(status.syncedAt)}` : ""}
            </p>
          )}
        </div>
        {!status.configured ? (
          <span className="text-xs text-muted-foreground">Not configured on this deployment</span>
        ) : status.connected ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await ingestGoogleNow(); (r.ok ? toast.success : toast.error)(r.message); router.refresh(); })}>
              Check now
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => start(async () => { await disconnectGoogle(); router.refresh(); })}>
              Disconnect
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" render={<a href="/api/google/connect" />}>Connect</Button>
        )}
      </div>
    </div>
  );
}
