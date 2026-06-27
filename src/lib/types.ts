import type {
  campaigns,
  contentItems,
  crmAccounts,
  crmActivities,
  crmContacts,
  cycles,
  databaseFields,
  databaseRows,
  databases,
  deals,
  expenses,
  features,
  initiatives,
  invoices,
  issues,
  labels,
  pages,
  projects,
  teams,
  ticketComments,
  tickets,
  users,
  workspaces,
} from "@/db/schema";

// Client-facing workspace shape — deliberately EXCLUDES secrets
// (slackWebhookUrl, githubToken) so they never reach the browser.
export type Workspace = Pick<
  typeof workspaces.$inferSelect,
  "id" | "name" | "slug" | "githubRepo" | "createdAt"
>;
export type WorkspaceWithRole = Workspace & { role: string };

// Shared, client-safe types and helpers (no server-only imports here).

export type Member = typeof users.$inferSelect;
export type Role = "admin" | "member";
export type MemberWithRole = Member & { role: string };
export type Project = typeof projects.$inferSelect;
export type Label = typeof labels.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Cycle = typeof cycles.$inferSelect;
export type Initiative = typeof initiatives.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamWithCount = Team & { issueCount: number; memberCount: number };

// ---- CRM / Sales / Marketing (Project × Department matrix) ----
export type CrmAccount = typeof crmAccounts.$inferSelect;
export type CrmContact = typeof crmContacts.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type CrmActivity = typeof crmActivities.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;

export type DealWithRelations = Deal & {
  account: CrmAccount | null;
  contact: CrmContact | null;
  owner: Member | null;
  project: Project | null;
};

export type ContactWithAccount = CrmContact & {
  account: CrmAccount | null;
  owner: Member | null;
};

export type AccountWithRelations = CrmAccount & {
  owner: Member | null;
  contacts: CrmContact[];
  deals: Deal[];
};

export type ActivityWithActor = CrmActivity & { actor: Member | null };

export type AccountDetail = AccountWithRelations & {
  activities: ActivityWithActor[];
};

export type CampaignWithRelations = Campaign & {
  owner: Member | null;
  project: Project | null;
  contentCount: number;
};

export type ContentItemWithCampaign = ContentItem & {
  campaign: Campaign | null;
  owner: Member | null;
};

export type Invoice = typeof invoices.$inferSelect;
export type Expense = typeof expenses.$inferSelect;

export type InvoiceWithRelations = Invoice & {
  account: CrmAccount | null;
  project: Project | null;
  owner: Member | null;
};

export type ExpenseWithRelations = Expense & {
  project: Project | null;
  owner: Member | null;
};

export type Ticket = typeof tickets.$inferSelect;
export type TicketComment = typeof ticketComments.$inferSelect;

export type TicketWithRelations = Ticket & {
  account: CrmAccount | null;
  contact: CrmContact | null;
  assignee: Member | null;
  project: Project | null;
};

export type TicketCommentWithAuthor = TicketComment & { author: Member | null };

/** A product (project) plus the counts shown on the project hub cards. */
export type ProjectSummary = Project & {
  openDeals: number;
  pipelineValue: number;
  openIssues: number;
  activeCampaigns: number;
  revenue: number; // sum of paid invoices
  openTickets: number;
  openFeatures: number;
};

export type Feature = typeof features.$inferSelect;

export type FeatureWithRelations = Feature & {
  project: Project | null;
  owner: Member | null;
  page: { id: string; title: string; icon: string } | null;
  progress: { done: number; total: number; pct: number };
};

export type FeatureDetail = FeatureWithRelations & {
  issues: IssueWithRelations[];
};

export type IssueParentRef = {
  id: string;
  number: number;
  title: string;
  project: Project | null;
};

export type IssueWithRelations = Issue & {
  project: Project | null;
  cycle: Cycle | null;
  team: Team | null;
  assignee: Member | null;
  labels: Label[];
};

export type IssueDetail = IssueWithRelations & {
  linkedPages: Page[];
  parent: IssueParentRef | null;
  subIssues: IssueWithRelations[];
};

export type RelationItem = {
  relationId: string;
  type: "blocks" | "related" | "duplicate";
  direction: "outgoing" | "incoming";
  issue: { id: string; number: number; title: string; status: string; project: Project | null };
};

export type CycleWithCount = Cycle & { issueCount: number; doneCount: number };
export type InitiativeWithCount = Initiative & { projectCount: number };
export type ProjectWithIssueCount = Project & {
  issueCount: number;
  doneCount: number;
};

export type ProjectDetail = Project & {
  initiative: Initiative | null;
  ownerTeam: Team | null;
  issues: IssueWithRelations[];
};

export const PROJECT_HEALTH = [
  { id: "on_track", label: "On track", color: "#5e9b51" },
  { id: "at_risk", label: "At risk", color: "#f2c94c" },
  { id: "off_track", label: "Off track", color: "#eb5757" },
] as const;

export type ProjectHealth = (typeof PROJECT_HEALTH)[number]["id"];

export type StatusUpdateItem = {
  id: string;
  health: string;
  body: string;
  createdAt: Date;
  author: Member | null;
};

export type Insights = {
  total: number;
  completed: number;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  assignees: { id: string; name: string; color: string; open: number }[];
  cycles: { id: string; name: string; total: number; done: number }[];
};

/** Cycle status derived from its date range relative to `now`. */
export function cycleStatus(
  c: { startDate: Date | string; endDate: Date | string },
  now: Date,
): "upcoming" | "active" | "completed" {
  const start = new Date(c.startDate).getTime();
  const end = new Date(c.endDate).getTime();
  const t = now.getTime();
  if (t < start) return "upcoming";
  if (t > end) return "completed";
  return "active";
}

export type Database = typeof databases.$inferSelect;
export type DatabaseField = typeof databaseFields.$inferSelect;
export type DatabaseRow = typeof databaseRows.$inferSelect;

/** A database referenced by a relation field, with the data needed to render
 *  relation chips and compute rollups. */
export type RelatedDatabase = {
  id: string;
  name: string;
  primaryFieldId: string | null;
  fields: DatabaseField[];
  rows: DatabaseRow[];
};

export type DatabaseWithSchema = Database & {
  fields: DatabaseField[];
  rows: DatabaseRow[];
  /** Keyed by target database id, for relation/rollup fields. */
  related: Record<string, RelatedDatabase>;
};

export type RollupFn = "count" | "sum" | "min" | "max" | "avg";

export type RollupConfig = {
  relationFieldId: string;
  targetFieldId: string | null;
  fn: RollupFn;
};

export type SelectOption = { label: string; color: string };

/** Field types selectable when adding a database field. */
export const FIELD_TYPES = [
  { id: "text", label: "Text", icon: "T" },
  { id: "number", label: "Number", icon: "#" },
  { id: "select", label: "Select", icon: "▾" },
  { id: "multiSelect", label: "Multi-select", icon: "≣" },
  { id: "checkbox", label: "Checkbox", icon: "☑" },
  { id: "date", label: "Date", icon: "📅" },
  { id: "url", label: "URL", icon: "🔗" },
  { id: "email", label: "Email", icon: "@" },
  { id: "relation", label: "Relation", icon: "⛓" },
  { id: "rollup", label: "Rollup", icon: "Σ" },
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]["id"];

export const SELECT_COLORS = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6",
  "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#64748b",
];

export type ReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type CommentItem = {
  kind: "comment";
  id: string;
  createdAt: Date;
  author: Member | null;
  body: string;
  reactions: ReactionSummary[];
};

export type ActivityItem = {
  kind: "activity";
  id: string;
  createdAt: Date;
  actor: Member | null;
  type: string;
  data: { from?: string | null; to?: string | null } | null;
};

export type TimelineItem = CommentItem | ActivityItem;

export const INITIATIVE_STATUSES = [
  { id: "planned", label: "Planned", color: "#bec2c8" },
  { id: "active", label: "Active", color: "#5e6ad2" },
  { id: "completed", label: "Completed", color: "#5e9b51" },
] as const;

export type PageNode = Page & { children: PageNode[] };

export type FlatIssue = {
  id: string;
  title: string;
  number: number;
  status: string;
  projectKey: string | null;
};

export type FlatPage = Pick<Page, "id" | "title" | "icon">;

/** Display identifier like ENG-12, falling back to a short id when no project. */
export function issueIdentifier(issue: {
  number: number;
  project?: { key: string } | null;
}): string {
  return issue.project ? `${issue.project.key}-${issue.number}` : `#${issue.number}`;
}

export type SearchResultKind =
  | "issue"
  | "page"
  | "project"
  | "initiative"
  | "database"
  | "team"
  | "cycle";

export type SearchResult = {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle?: string | null;
  icon?: string | null;
  href: string;
};

/** An entity that can be @-mentioned inside a rich-text body. */
export type MentionItem = {
  kind: "issue" | "page" | "project";
  id: string;
  label: string;
  hint?: string;
};

/** An incoming reference shown in a backlinks panel. */
export type BacklinkItem = {
  kind: "issue" | "page";
  id: string;
  title: string;
  href: string;
};

export type ProposedIssue = { title: string; description: string };

export type SavedViewConfig = {
  status: string[];
  priority: string[];
  assignee: string[];
  label: string[];
  sort: string;
  groupBy: string;
  view: string;
};

export type SavedView = { id: string; name: string; config: SavedViewConfig };

export type AskSource = { kind: "issue" | "page"; title: string; href: string };
export type AskResult = { answer: string; sources: AskSource[] };

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: Date | null;
  issueId: string | null;
  createdAt: Date;
  actor: Member | null;
};

export type FavoriteKind = "issue" | "page" | "project";

export type FavoriteItem = {
  id: string;
  kind: FavoriteKind;
  targetId: string;
  title: string;
  icon: string | null;
  href: string;
};

export type Attachment = {
  id: string;
  name: string;
  url: string;
  contentType: string | null;
  size: number;
  createdAt: Date;
  uploader: Member | null;
};
