"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export default function NoAccessPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/auth/sign-in");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-destructive/10">
          <ShieldX className="size-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold">No workspace access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account isn&apos;t a member of this workspace. Ask an admin to invite
          you, then sign in again.
        </p>
        <Button onClick={signOut} disabled={pending} className="mt-5 w-full">
          Sign out
        </Button>
      </div>
    </div>
  );
}
