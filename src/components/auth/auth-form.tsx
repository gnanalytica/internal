"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 1.27a11 11 0 0 0-3.48 21.46c.55.09.73-.24.73-.53v-1.85c-3.03.66-3.67-1.46-3.67-1.46-.5-1.27-1.21-1.6-1.21-1.6-1-.68.07-.66.07-.66 1.1.08 1.68 1.13 1.68 1.13.97 1.67 2.55 1.19 3.17.91.1-.71.38-1.19.69-1.46-2.42-.28-4.96-1.21-4.96-5.38 0-1.19.42-2.16 1.12-2.92-.11-.28-.49-1.39.11-2.9 0 0 .92-.29 3 1.12a10.4 10.4 0 0 1 5.46 0c2.08-1.41 3-1.12 3-1.12.6 1.51.22 2.62.11 2.9.7.76 1.12 1.73 1.12 2.92 0 4.18-2.55 5.1-4.98 5.37.39.34.74 1 .74 2.03v3.01c0 .29.18.63.74.52A11 11 0 0 0 12 1.27Z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"email" | "google" | "github" | null>(null);

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending("email");
    const res = isSignUp
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password });
    if (res.error) {
      setError(res.error.message || "Something went wrong. Try again.");
      setPending(null);
      return;
    }
    router.push("/issues");
    router.refresh();
  }

  async function onSocial(provider: "google" | "github") {
    setError(null);
    setPending(provider);
    const res = await authClient.signIn.social({
      provider,
      callbackURL: "/issues",
    });
    if (res?.error) {
      setError(res.error.message || `Could not continue with ${provider}.`);
      setPending(null);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Brand */}
      <div className="mb-7 flex flex-col items-center gap-3 text-center">
        <span className="grid size-10 place-items-center rounded-xl bg-brand text-lg font-bold text-brand-foreground shadow-sm">
          A
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignUp
              ? "Start using your docs + issues workspace."
              : "Sign in to your docs + issues workspace."}
          </p>
        </div>
      </div>

      {/* Social */}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full gap-2"
          disabled={pending !== null}
          onClick={() => onSocial("google")}
        >
          <GoogleIcon className="size-4" />
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full gap-2"
          disabled={pending !== null}
          onClick={() => onSocial("github")}
        >
          <GitHubIcon className="size-4" />
          Continue with GitHub
        </Button>
      </div>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Email / password */}
      <form onSubmit={onEmailSubmit} className="flex flex-col gap-3">
        {isSignUp && (
          <Field
            label="Name"
            type="text"
            value={name}
            onChange={setName}
            placeholder="Jane Doe"
            required
            autoComplete="name"
          />
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          required
          autoComplete="email"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          required
          autoComplete={isSignUp ? "new-password" : "current-password"}
          minLength={8}
        />

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="mt-1 h-10 w-full" disabled={pending !== null}>
          {pending === "email"
            ? isSignUp
              ? "Creating account…"
              : "Signing in…"
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      {/* Switch */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <Link
          href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}
          className="font-medium text-brand hover:underline"
        >
          {isSignUp ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  minLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        className={cn(
          "h-10 rounded-lg border bg-background px-3 text-sm outline-none transition-colors",
          "placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20",
        )}
      />
    </label>
  );
}
