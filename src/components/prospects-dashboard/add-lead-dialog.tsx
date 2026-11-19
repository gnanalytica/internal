"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addLinkedInProspect } from "@/lib/prospects/actions";
import { canonicalLinkedInUrl, type DuplicateMatch } from "@/lib/prospects/linkedin";
import { KIND_LABEL, LINKEDIN_HOW_MET, type ProspectKind } from "@/lib/prospects/schema";
import { cn } from "@/lib/utils";
import { Chips, KindDot, LinkedInGlyph } from "./bits";

type HowMet = (typeof LINKEDIN_HOW_MET)[number];

const EMPTY = { linkedinUrl: "", name: "", headline: "", company: "", city: "", state: "", phone: "", email: "", notes: "" };

/** "https://linkedin.com/in/ravi-kumar-9a1b" → "Ravi Kumar", a head start the person can overwrite. */
function nameFromUrl(url: string): string {
  const slug = canonicalLinkedInUrl(url).match(/\/in\/([^/]+)/)?.[1] ?? "";
  return slug
    .split("-")
    .filter((w) => w && !/\d/.test(w))
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function Field({ label, hint, htmlFor, className, children }: { label: string; hint?: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground/80">
        {label}
        {hint && <span className="font-normal text-muted-foreground"> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}

/**
 * Add a prospect who came to us on LinkedIn. Paste the profile link first —
 * it fills a guess at the name and is what the duplicate check keys on — and
 * the rest is whatever the profile or the conversation told you.
 */
export function AddLeadDialog({
  open,
  onOpenChange,
  onAdded,
  onOpenExisting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (id: string) => void;
  onOpenExisting: (r: { kind: ProspectKind; id: string }) => void;
}) {
  const [f, setF] = useState(EMPTY);
  const [howMet, setHowMet] = useState<HowMet>("They messaged us");
  const [nameTouched, setNameTouched] = useState(false);
  const [dupes, setDupes] = useState<DuplicateMatch[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setF((p) => ({ ...p, [k]: v, ...(k === "linkedinUrl" && !nameTouched ? { name: nameFromUrl(v) } : {}) }));
    setDupes([]);
    setError("");
  };

  const urlBad = f.linkedinUrl.trim() !== "" && !canonicalLinkedInUrl(f.linkedinUrl);

  const reset = () => {
    setF(EMPTY);
    setHowMet("They messaged us");
    setNameTouched(false);
    setDupes([]);
    setError("");
  };

  const submit = (force = false) => {
    if (!f.name.trim()) return setError("Add their name.");
    start(async () => {
      const res = await addLinkedInProspect({ ...f, howMet, force });
      if (res.ok) {
        toast.success(res.message);
        reset();
        onOpenChange(false);
        onAdded(res.id);
      } else if (res.duplicates?.length) {
        setDupes(res.duplicates);
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) submit();
          }}
        >
          <DialogHeader className="gap-0.5 border-b px-5 pt-5 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <LinkedInGlyph className="size-4 text-[#0a66c2]" /> Add a LinkedIn lead
            </DialogTitle>
            <DialogDescription>Goes on the LinkedIn Leads tab, assigned to you, as Not contacted.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <Field label="Profile link" hint="paste from LinkedIn" htmlFor="li-url" className="sm:col-span-2">
              <Input id="li-url" autoFocus value={f.linkedinUrl} onChange={set("linkedinUrl")} placeholder="https://www.linkedin.com/in/…" className="h-8" aria-invalid={urlBad || undefined} />
              {urlBad && <p className="text-xs text-amber-700 dark:text-amber-400">That doesn&apos;t look like a LinkedIn profile link. It will be saved as typed.</p>}
            </Field>
            <Field label="Name" htmlFor="li-name">
              <Input
                id="li-name"
                value={f.name}
                onChange={(e) => {
                  setNameTouched(true);
                  set("name")(e);
                }}
                placeholder="Full name"
                className="h-8"
              />
            </Field>
            <Field label="Company" hint="optional" htmlFor="li-company">
              <Input id="li-company" value={f.company} onChange={set("company")} placeholder="e.g. SBI, own practice" className="h-8" />
            </Field>
            <Field label="Headline / role" hint="optional" htmlFor="li-headline" className="sm:col-span-2">
              <Input id="li-headline" value={f.headline} onChange={set("headline")} placeholder="e.g. Registered Valuer (L&B) · Chartered Engineer" className="h-8" />
            </Field>
            <Field label="City" hint="optional" htmlFor="li-city">
              <Input id="li-city" value={f.city} onChange={set("city")} placeholder="e.g. Hyderabad" className="h-8" />
            </Field>
            <Field label="State" hint="optional" htmlFor="li-state">
              <Input id="li-state" value={f.state} onChange={set("state")} placeholder="e.g. Telangana" className="h-8" />
            </Field>
            <Field label="Phone" hint="optional" htmlFor="li-phone">
              <Input id="li-phone" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="+91…" className="h-8" />
            </Field>
            <Field label="Email" hint="optional" htmlFor="li-email">
              <Input id="li-email" type="email" value={f.email} onChange={set("email")} placeholder="name@…" className="h-8" />
            </Field>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-foreground/80">How they came in</span>
              <Chips label="How they came in" value={howMet} options={LINKEDIN_HOW_MET} onChange={(v) => v && setHowMet(v)} />
            </div>
            <Field label="Notes" hint="optional" htmlFor="li-notes" className="sm:col-span-2">
              <Textarea id="li-notes" value={f.notes} onChange={set("notes")} rows={3} placeholder="What they said, what they're looking for" className="resize-none text-sm" />
            </Field>
          </div>

          {dupes.length > 0 && (
            <div className="mx-5 mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
              <p className="font-medium">This looks like someone we already have</p>
              <ul className="mt-2 flex flex-col gap-1">
                {dupes.map((d) => (
                  <li key={`${d.kind}:${d.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        reset();
                        onOpenExisting(d);
                      }}
                      className="inline-flex items-center gap-1.5 text-left hover:underline"
                    >
                      <KindDot kind={d.kind} />
                      <span className="font-medium">{d.name || d.id}</span>
                      <span className="text-muted-foreground">
                        {KIND_LABEL[d.kind].one} · {d.why}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="mx-5 mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {dupes.length > 0 ? (
              <Button type="button" size="sm" disabled={pending} onClick={() => submit(true)}>
                {pending ? "Adding…" : "Add anyway"}
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={pending || !f.name.trim()}>
                {pending ? "Adding…" : "Add lead"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
