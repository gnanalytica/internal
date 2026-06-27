import "server-only";

import { db } from "@/db";
import {
  campaigns,
  crmAccounts,
  crmContacts,
  deals,
  expenses,
  invoices,
  tickets,
} from "@/db/schema";

/**
 * Workspace-scoped create helpers for the public REST API. Unlike the server
 * actions in lib/actions.ts (which resolve the workspace/user from cookies),
 * these take an explicit workspaceId + userId from the API-key auth context.
 */

const toDate = (v?: string | null): Date | null => (v ? new Date(v) : null);

export async function apiCreateDeal(
  workspaceId: string,
  userId: string | null,
  input: {
    name?: string;
    projectId?: string | null;
    accountId?: string | null;
    stage?: string;
    value?: number;
    entity?: string;
    expectedClose?: string | null;
  },
): Promise<string> {
  if (!input.name?.trim()) throw new Error("`name` is required.");
  const [created] = await db
    .insert(deals)
    .values({
      workspaceId,
      name: input.name.trim(),
      projectId: input.projectId ?? null,
      accountId: input.accountId ?? null,
      stage: input.stage ?? "lead",
      value: input.value ?? 0,
      entity: input.entity ?? "Global",
      expectedClose: toDate(input.expectedClose),
      ownerId: userId,
      sortKey: `z${Date.now()}`,
    })
    .returning({ id: deals.id });
  return created.id;
}

export async function apiCreateAccount(
  workspaceId: string,
  userId: string | null,
  input: { name?: string; website?: string | null; industry?: string | null; type?: string; entity?: string },
): Promise<string> {
  if (!input.name?.trim()) throw new Error("`name` is required.");
  const [created] = await db
    .insert(crmAccounts)
    .values({
      workspaceId,
      name: input.name.trim(),
      website: input.website ?? null,
      industry: input.industry ?? null,
      type: input.type ?? "prospect",
      entity: input.entity ?? "Global",
      ownerId: userId,
    })
    .returning({ id: crmAccounts.id });
  return created.id;
}

export async function apiCreateContact(
  workspaceId: string,
  userId: string | null,
  input: { name?: string; email?: string | null; title?: string | null; accountId?: string | null; entity?: string },
): Promise<string> {
  if (!input.name?.trim()) throw new Error("`name` is required.");
  const [created] = await db
    .insert(crmContacts)
    .values({
      workspaceId,
      name: input.name.trim(),
      email: input.email ?? null,
      title: input.title ?? null,
      accountId: input.accountId ?? null,
      entity: input.entity ?? "Global",
      ownerId: userId,
    })
    .returning({ id: crmContacts.id });
  return created.id;
}

export async function apiCreateCampaign(
  workspaceId: string,
  userId: string | null,
  input: { name?: string; projectId?: string | null; channel?: string; status?: string; budget?: number; entity?: string },
): Promise<string> {
  if (!input.name?.trim()) throw new Error("`name` is required.");
  const [created] = await db
    .insert(campaigns)
    .values({
      workspaceId,
      name: input.name.trim(),
      projectId: input.projectId ?? null,
      channel: input.channel ?? "email",
      status: input.status ?? "planned",
      budget: input.budget ?? 0,
      entity: input.entity ?? "Global",
      ownerId: userId,
    })
    .returning({ id: campaigns.id });
  return created.id;
}

export async function apiCreateInvoice(
  workspaceId: string,
  userId: string | null,
  input: { number?: string | null; projectId?: string | null; accountId?: string | null; status?: string; amount?: number; entity?: string; dueDate?: string | null },
): Promise<string> {
  const [created] = await db
    .insert(invoices)
    .values({
      workspaceId,
      number: input.number ?? null,
      projectId: input.projectId ?? null,
      accountId: input.accountId ?? null,
      status: input.status ?? "draft",
      amount: input.amount ?? 0,
      entity: input.entity ?? "Global",
      dueDate: toDate(input.dueDate),
      ownerId: userId,
    })
    .returning({ id: invoices.id });
  return created.id;
}

export async function apiCreateExpense(
  workspaceId: string,
  userId: string | null,
  input: { vendor?: string | null; projectId?: string | null; category?: string; amount?: number; status?: string; entity?: string; spentDate?: string | null },
): Promise<string> {
  const [created] = await db
    .insert(expenses)
    .values({
      workspaceId,
      vendor: input.vendor ?? null,
      projectId: input.projectId ?? null,
      category: input.category ?? "other",
      amount: input.amount ?? 0,
      status: input.status ?? "planned",
      entity: input.entity ?? "Global",
      spentDate: toDate(input.spentDate),
      ownerId: userId,
    })
    .returning({ id: expenses.id });
  return created.id;
}

export async function apiCreateTicket(
  workspaceId: string,
  _userId: string | null,
  input: { subject?: string; projectId?: string | null; accountId?: string | null; status?: string; priority?: string; requesterEmail?: string | null; entity?: string },
): Promise<string> {
  if (!input.subject?.trim()) throw new Error("`subject` is required.");
  const [created] = await db
    .insert(tickets)
    .values({
      workspaceId,
      subject: input.subject.trim(),
      projectId: input.projectId ?? null,
      accountId: input.accountId ?? null,
      status: input.status ?? "open",
      priority: input.priority ?? "normal",
      requesterEmail: input.requesterEmail ?? null,
      entity: input.entity ?? "Global",
      sortKey: `z${Date.now()}`,
    })
    .returning({ id: tickets.id });
  return created.id;
}
