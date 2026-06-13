"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { GitHubIcon, GoogleIcon } from "@/components/auth/provider-icons";
import { UserAvatar } from "@/components/glyphs";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

type ProviderId = "google" | "github" | "credential";

const PROVIDERS: {
  id: ProviderId;
  label: string;
  desc: string;
  icon: React.ReactNode;
  social: boolean;
}[] = [
  {
    id: "google",
    label: "Google",
    desc: "Sign in with your Google account",
    icon: <GoogleIcon className="size-5" />,
    social: true,
  },
  {
    id: "github",
    label: "GitHub",
    desc: "Sign in with your GitHub account",
    icon: <GitHubIcon className="size-5" />,
    social: true,
  },
  {
    id: "credential",
    label: "Email & password",
    desc: "Sign in with your email and a password",
    icon: <Mail className="size-5 text-muted-foreground" />,
    social: false,
  },
];

export function AccountSettings({
  name,
  email,
  providerIds,
}: {
  name: string;
  email: string;
  providerIds: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [pending, startTransition] = useTransition();
  const connected = new Set(providerIds);
  const connectedCount = PROVIDERS.filter((p) => connected.has(p.id)).length;

  async function connect(provider: "google" | "github") {
    setBusy(provider);
    const res = await authClient.linkSocial({ provider, callbackURL: "/settings" });
    if (res?.error) {
      toast.error(res.error.message || `Could not connect ${provider}.`);
      setBusy(null);
    }
    // On success the browser redirects to the provider, then back to /settings.
  }

  function disconnect(providerId: ProviderId) {
    if (connectedCount <= 1) {
      toast.error("You can't remove your only sign-in method.");
      return;
    }
    setBusy(providerId);
    startTransition(async () => {
      const res = await authClient.unlinkAccount({ providerId });
      if (res?.error) {
        toast.error(res.error.message || "Could not disconnect.");
      } else {
        toast.success("Sign-in method disconnected.");
        router.refresh();
      }
      setBusy(null);
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Settings" }, { label: "Account" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-8 py-10">
          {/* Profile */}
          <div className="mb-8 flex items-center gap-3">
            <UserAvatar name={name} color="#6366f1" className="size-12 text-base" />
            <div>
              <div className="text-lg font-semibold">{name}</div>
              <div className="text-sm text-muted-foreground">{email}</div>
            </div>
          </div>

          {/* Sign-in methods */}
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Sign-in methods</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Connect more than one — any connected method signs you into this same account.
          </p>

          <div className="divide-y rounded-xl border">
            {PROVIDERS.map((p) => {
              const isConnected = connected.has(p.id);
              const isBusy = busy === p.id || pending;
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background">
                    {p.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {p.label}
                      {isConnected && (
                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                          Connected
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{p.desc}</div>
                  </div>

                  {isConnected ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isBusy || connectedCount <= 1}
                      onClick={() => disconnect(p.id)}
                      className="text-muted-foreground hover:text-destructive"
                      title={
                        connectedCount <= 1 ? "You can't remove your only sign-in method" : undefined
                      }
                    >
                      Disconnect
                    </Button>
                  ) : p.social ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => connect(p.id as "google" | "github")}
                    >
                      {busy === p.id ? "Connecting…" : "Connect"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Set from sign-up
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Linking works when the providers share your verified email ({email}).
          </p>
        </div>
      </div>
    </div>
  );
}
