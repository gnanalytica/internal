"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { GitHubIcon, GoogleIcon } from "@/components/auth/provider-icons";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

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
