import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { membersQuery } from "@/features/workspace/api";
import { colorFor } from "@/lib/constants";

import { accountsQuery, contactsQuery, type Campaign } from "./api";
import type { Option } from "./constants";

export function useMemberOptions(): Option[] {
  const members = useQuery(membersQuery).data;
  return useMemo(() => (members ?? []).map((m) => ({ value: m.id, label: m.name, subtitle: m.title ?? m.email, color: colorFor(m.id) })), [members]);
}

export function useMemberName(): (id: string | null | undefined) => string | null {
  const members = useQuery(membersQuery).data;
  return (id) => (id ? members?.find((m) => m.id === id)?.name ?? null : null);
}

export function useAccountOptions(enabled = true): Option[] {
  const accounts = useQuery({ ...accountsQuery, enabled }).data;
  return useMemo(() => (accounts ?? []).map((a) => ({ value: a.id, label: a.name, subtitle: [a.industry, a.type].filter(Boolean).join(" · ") || undefined })), [accounts]);
}

/** Contacts, narrowed to one account's people when an account is chosen. */
export function useContactOptions(accountId?: string | null, enabled = true): Option[] {
  const contacts = useQuery({ ...contactsQuery, enabled }).data;
  return useMemo(
    () =>
      (contacts ?? [])
        .filter((c) => !accountId || c.account?.id === accountId)
        .map((c) => ({ value: c.id, label: c.name, subtitle: [c.title, c.account?.name].filter(Boolean).join(" · ") || c.email || undefined })),
    [contacts, accountId],
  );
}

export const campaignOptions = (campaigns: Campaign[] | undefined): Option[] => (campaigns ?? []).map((c) => ({ value: c.id, label: c.name }));
