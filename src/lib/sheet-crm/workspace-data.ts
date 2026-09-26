import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { crmAccounts } from "@/db/schema";
import type { ProspectsData } from "@/components/prospects/prospects-view";
import { getCurrentUser, getMembers } from "@/lib/data";
import { isSheetSyncConfigured } from "./google-auth";
import { SHEET_SOURCE } from "./projection";
import {
  getDataQualityIssues,
  getProspectFacets,
  getProspectStats,
  getRecentCellWrites,
  getResearchQueue,
  getSheetSyncRuns,
  getSheetTabRows,
  sheetSchemaReady,
} from "./queries";

export function sheetUrl(): string | null {
  const id = process.env.VALYTICA_CRM_SHEET_ID;
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
}

/** Everything the Prospects workspace renders, in one parallel fetch. */
export async function loadProspectsData(workspaceId: string): Promise<ProspectsData> {
  const schemaReady = await sheetSchemaReady();
  const [stats, facets, accounts, queue, quality, runs, writes, lenders, lenderContacts, officers, rvos, sources, personas, members, me] = await Promise.all([
    getProspectStats(workspaceId),
    getProspectFacets(workspaceId),
    schemaReady
      ? db
          .select()
          .from(crmAccounts)
          .where(and(eq(crmAccounts.workspaceId, workspaceId), eq(crmAccounts.externalSource, SHEET_SOURCE)))
          .orderBy(asc(crmAccounts.name))
      : Promise.resolve([]),
    getResearchQueue(workspaceId),
    getDataQualityIssues(workspaceId),
    getSheetSyncRuns(workspaceId, 10),
    getRecentCellWrites(workspaceId, 30),
    getSheetTabRows(workspaceId, "lender_landscape"),
    getSheetTabRows(workspaceId, "lender_contacts"),
    getSheetTabRows(workspaceId, "association_officers"),
    getSheetTabRows(workspaceId, "rvos"),
    getSheetTabRows(workspaceId, "source_inventory"),
    getSheetTabRows(workspaceId, "gtm_personas"),
    getMembers(workspaceId),
    getCurrentUser(workspaceId),
  ]);
  return {
    stats,
    facets,
    accounts,
    queue,
    quality,
    runs,
    writes,
    directories: { lenders, lenderContacts, officers, rvos, sources, personas },
    members,
    currentUserId: me.id,
    configured: isSheetSyncConfigured(),
    schemaReady,
    sheetUrl: sheetUrl(),
  };
}
