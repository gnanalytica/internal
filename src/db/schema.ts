import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema for the combined Notion + Linear workspace (v1 "thin slice of both").
 * Statuses and priorities are stored as plain text and validated in the app
 * (see src/lib/constants.ts) to keep the schema simple for v1.
 */

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  slackWebhookUrl: text("slack_webhook_url"),
  githubRepo: text("github_repo"), // "owner/repo"
  githubToken: text("github_token"),
  // Company-level "focus this quarter" bets shown on the Overview home.
  bets: jsonb("bets").$type<string[] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Tailwind-ish color token used to render the avatar fallback.
  avatarColor: text("avatar_color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // member | admin (access)
    // HR / directory fields (the People & HR home).
    title: text("title"), // job title, e.g. "Full-stack Engineer"
    entity: text("entity").notNull().default("Global"), // India | Netherlands | Global
    employment: text("employment").notNull().default("employee"), // employee | contractor
    startDate: timestamp("start_date", { withTimezone: true }),
    managerId: uuid("manager_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Short prefix used in issue identifiers, e.g. "ENG" -> ENG-12.
    key: text("key").notNull(),
    description: text("description"),
    // Public-facing one-liner (from the marketing site), shown on the Overview.
    tagline: text("tagline"),
    // Live product URL, e.g. https://valytica.gnanalytica.com.
    url: text("url"),
    color: text("color").notNull().default("#6366f1"),
    // Which department modules are enabled for this project. null = all enabled
    // (the auto-spawn default); an explicit array restricts to those slugs.
    enabledDepartments: jsonb("enabled_departments").$type<string[] | null>(),
    // 'project' = an app we ship (gets departments + CRM);
    // 'operation' = internal / back-office (no departments, no CRM).
    kind: text("kind").$type<"project" | "operation">().notNull().default("project"),
    // Confidential projects (e.g. Finance, People & HR) are visible to admins
    // (founders) only — enforced server-side and hidden from the nav.
    confidential: boolean("confidential").notNull().default(false),
    // Owner (a person). null if unassigned.
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    startDate: timestamp("start_date", { withTimezone: true }),
    targetDate: timestamp("target_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("projects_workspace_key_idx").on(t.workspaceId, t.key)],
);

export const labels = pgTable("labels", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#a1a1aa"),
});

/** Time-boxed iterations (Linear-style cycles / sprints). */
export const cycles = pgTable(
  "cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Cycles are project-scoped: planning + daily standups happen per project.
    // The company-wide "Weekly" is a rollup view, not a separate cadence.
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    number: integer("number").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cycles_workspace_idx").on(t.workspaceId),
    index("cycles_project_idx").on(t.projectId),
  ],
);

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    cycleId: uuid("cycle_id").references(() => cycles.id, {
      onDelete: "set null",
    }),
    featureId: uuid("feature_id").references(() => features.id, {
      onDelete: "set null",
    }),
    // Direct milestone link, used when a task rolls up to a milestone without a
    // feature (Milestone → Task). When featureId is set, the feature's milestone
    // takes precedence for display.
    milestoneId: uuid("milestone_id").references(() => milestones.id, {
      onDelete: "set null",
    }),
    // Self-reference for sub-issues; null = top-level issue.
    parentId: uuid("parent_id"),
    // Per-project incrementing number, combined with project key for display.
    number: integer("number").notNull(),
    title: text("title").notNull(),
    // Functional category — a task isn't only engineering. See ISSUE_TYPES.
    type: text("type").notNull().default("engineering"),
    // TipTap JSON document for the issue description.
    description: jsonb("description"),
    status: text("status").notNull().default("backlog"),
    priority: text("priority").notNull().default("none"),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    creatorId: uuid("creator_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Fractional sort key for ordering within a board column / list.
    sortKey: text("sort_key").notNull().default("a0"),
    startDate: timestamp("start_date", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    estimate: integer("estimate"),
    githubUrl: text("github_url"),
    githubNumber: integer("github_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("issues_workspace_idx").on(t.workspaceId),
    index("issues_status_idx").on(t.workspaceId, t.status),
    uniqueIndex("issues_project_number_idx").on(t.projectId, t.number),
  ],
);

export const issueLabels = pgTable(
  "issue_labels",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.labelId] })],
);

/**
 * Multiple assignees per issue. `issues.assigneeId` is kept as the primary/lead
 * assignee (drives grouping, sort, board avatar); this table holds the full set
 * (including the primary).
 */
export const issueAssignees = pgTable(
  "issue_assignees",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.userId] })],
);

export const issueAssigneesRelations = relations(issueAssignees, ({ one }) => ({
  issue: one(issues, { fields: [issueAssignees.issueId], references: [issues.id] }),
  user: one(users, { fields: [issueAssignees.userId], references: [users.id] }),
}));

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // null = company wiki (handbook/SOPs/entity refs); set = that project's Docs.
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    parentId: uuid("parent_id"),
    title: text("title").notNull().default("Untitled"),
    icon: text("icon").notNull().default("📄"),
    // TipTap JSON document for the page body.
    content: jsonb("content"),
    // Plain-text extraction of `content` for full-text search.
    contentText: text("content_text").notNull().default(""),
    // Fractional sort key for ordering siblings in the page tree.
    position: text("position").notNull().default("a0"),
    creatorId: uuid("creator_id").references(() => users.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pages_workspace_parent_idx").on(t.workspaceId, t.parentId)],
);

/** Bidirectional links between an issue and a page. */
export const issuePageLinks = pgTable(
  "issue_page_links",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.pageId] })],
);

/** A user-defined database (Notion-style). */
export const databases = pgTable("databases", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled database"),
  icon: text("icon").notNull().default("🗃️"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A column/property of a database. */
export const databaseFields = pgTable(
  "database_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    databaseId: uuid("database_id")
      .notNull()
      .references(() => databases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default("text"), // text|number|select|checkbox|date|relation|rollup
    options: jsonb("options"), // for select: [{ label, color }]
    // For relation fields: the database whose rows this field links to.
    relationDatabaseId: uuid("relation_database_id"),
    // For rollup fields: { relationFieldId, targetFieldId, fn }.
    config: jsonb("config"),
    // Column width in px for the table view (null = default).
    width: integer("width"),
    position: text("position").notNull().default("a0"),
  },
  (t) => [index("database_fields_db_idx").on(t.databaseId)],
);

/** A row of a database; cell values stored as { [fieldId]: value }. */
export const databaseRows = pgTable(
  "database_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    databaseId: uuid("database_id")
      .notNull()
      .references(() => databases.id, { onDelete: "cascade" }),
    values: jsonb("values").notNull().default({}),
    position: text("position").notNull().default("a0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("database_rows_db_idx").on(t.databaseId)],
);

/** Comments on an issue. */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_issue_idx").on(t.issueId)],
);

/** Activity log of issue events (status/assignee/etc. changes). */
export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(), // created | status | assignee | priority | title
    data: jsonb("data"), // { from, to }
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_issue_idx").on(t.issueId)],
);

/** Per-user inbox notifications (assignment, comments). */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(), // assigned | commented | mentioned | status
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    read: timestamp("read", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.workspaceId, t.userId),
  ],
);

/** File attachments on issues (stored in Vercel Blob). */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    uploaderId: uuid("uploader_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    contentType: text("content_type"),
    size: integer("size").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_issue_idx").on(t.issueId)],
);

/** Directed relations between issues (blocks / related / duplicate). */
export const issueRelations = pgTable(
  "issue_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    relatedIssueId: uuid("related_issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // blocks | related | duplicate
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("issue_relations_issue_idx").on(t.issueId)],
);

/**
 * Cross-entity references extracted from rich-text bodies (the "graph" that
 * ties docs and work together). A reference points FROM a body (issue or page)
 * TO an entity (issue, page, or project).
 */
export const references = pgTable(
  "references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(), // issue | page
    sourceId: uuid("source_id").notNull(),
    targetType: text("target_type").notNull(), // issue | page | project
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("references_unique_idx").on(
      t.sourceType,
      t.sourceId,
      t.targetType,
      t.targetId,
    ),
    index("references_target_idx").on(t.workspaceId, t.targetType, t.targetId),
    index("references_source_idx").on(t.sourceType, t.sourceId),
  ],
);

/** Linear-style project status updates (on track / at risk / off track). */
export const projectStatusUpdates = pgTable(
  "project_status_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    health: text("health").notNull(), // on_track | at_risk | off_track
    body: text("body").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("project_status_updates_project_idx").on(t.projectId)],
);

/** Workspace API keys for programmatic + AI-agent access. */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_keys_workspace_idx").on(t.workspaceId)],
);

/** Outbound webhooks for workspace events. */
export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    events: jsonb("events").notNull(), // string[] of event names, or ["*"]
    active: boolean("active").notNull().default(true),
    lastStatus: integer("last_status"),
    lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhooks_workspace_idx").on(t.workspaceId)],
);

/** Named, workspace-shared issue views (filters + sort + grouping + layout). */
export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    config: jsonb("config").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saved_views_workspace_idx").on(t.workspaceId)],
);

/** Per-user favorites (issues, pages, projects). */
export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // issue | page | project
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("favorites_unique_idx").on(t.userId, t.kind, t.targetId),
    index("favorites_user_idx").on(t.workspaceId, t.userId),
  ],
);

/** Emoji reactions on comments. */
export const commentReactions = pgTable(
  "comment_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("comment_reactions_unique_idx").on(t.commentId, t.userId, t.emoji),
    index("comment_reactions_comment_idx").on(t.commentId),
  ],
);

// ---- Relations (for drizzle query API) ----

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  projects: many(projects),
  issues: many(issues),
  pages: many(pages),
  labels: many(labels),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(workspaceMembers),
  assignedIssues: many(issues),
}));

export const cyclesRelations = relations(cycles, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [cycles.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [cycles.projectId],
    references: [projects.id],
  }),
  issues: many(issues),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  issues: many(issues),
  cycles: many(cycles),
  pages: many(pages),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [issues.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  cycle: one(cycles, {
    fields: [issues.cycleId],
    references: [cycles.id],
  }),
  feature: one(features, {
    fields: [issues.featureId],
    references: [features.id],
  }),
  milestone: one(milestones, {
    fields: [issues.milestoneId],
    references: [milestones.id],
  }),
  assignee: one(users, {
    fields: [issues.assigneeId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [issues.creatorId],
    references: [users.id],
  }),
  parent: one(issues, {
    fields: [issues.parentId],
    references: [issues.id],
    relationName: "issue_subissues",
  }),
  subIssues: many(issues, { relationName: "issue_subissues" }),
  labels: many(issueLabels),
  assignees: many(issueAssignees),
  pageLinks: many(issuePageLinks),
  comments: many(comments),
  activity: many(activity),
  attachments: many(attachments),
}));

export const databasesRelations = relations(databases, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [databases.workspaceId],
    references: [workspaces.id],
  }),
  fields: many(databaseFields),
  rows: many(databaseRows),
}));

export const databaseFieldsRelations = relations(databaseFields, ({ one }) => ({
  database: one(databases, {
    fields: [databaseFields.databaseId],
    references: [databases.id],
  }),
}));

export const databaseRowsRelations = relations(databaseRows, ({ one }) => ({
  database: one(databases, {
    fields: [databaseRows.databaseId],
    references: [databases.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  issue: one(issues, { fields: [comments.issueId], references: [issues.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
  reactions: many(commentReactions),
}));

export const commentReactionsRelations = relations(commentReactions, ({ one }) => ({
  comment: one(comments, {
    fields: [commentReactions.commentId],
    references: [comments.id],
  }),
  user: one(users, { fields: [commentReactions.userId], references: [users.id] }),
}));

export const issueRelationsRelations = relations(issueRelations, ({ one }) => ({
  issue: one(issues, {
    fields: [issueRelations.issueId],
    references: [issues.id],
    relationName: "relation_from",
  }),
  relatedIssue: one(issues, {
    fields: [issueRelations.relatedIssueId],
    references: [issues.id],
    relationName: "relation_to",
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
}));

export const projectStatusUpdatesRelations = relations(
  projectStatusUpdates,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectStatusUpdates.projectId],
      references: [projects.id],
    }),
    author: one(users, {
      fields: [projectStatusUpdates.authorId],
      references: [users.id],
    }),
  }),
);

export const activityRelations = relations(activity, ({ one }) => ({
  issue: one(issues, { fields: [activity.issueId], references: [issues.id] }),
  actor: one(users, { fields: [activity.actorId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  issue: one(issues, { fields: [notifications.issueId], references: [issues.id] }),
  actor: one(users, { fields: [notifications.actorId], references: [users.id] }),
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  issue: one(issues, { fields: [attachments.issueId], references: [issues.id] }),
  uploader: one(users, {
    fields: [attachments.uploaderId],
    references: [users.id],
  }),
}));

export const labelsRelations = relations(labels, ({ many }) => ({
  issues: many(issueLabels),
}));

export const issueLabelsRelations = relations(issueLabels, ({ one }) => ({
  issue: one(issues, {
    fields: [issueLabels.issueId],
    references: [issues.id],
  }),
  label: one(labels, {
    fields: [issueLabels.labelId],
    references: [labels.id],
  }),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [pages.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [pages.projectId],
    references: [projects.id],
  }),
  parent: one(pages, {
    fields: [pages.parentId],
    references: [pages.id],
    relationName: "page_children",
  }),
  children: many(pages, { relationName: "page_children" }),
  issueLinks: many(issuePageLinks),
}));

export const issuePageLinksRelations = relations(issuePageLinks, ({ one }) => ({
  issue: one(issues, {
    fields: [issuePageLinks.issueId],
    references: [issues.id],
  }),
  page: one(pages, {
    fields: [issuePageLinks.pageId],
    references: [pages.id],
  }),
}));

/**
 * ---- CRM / Sales / Marketing (the Project × Department matrix) ----
 *
 * Department records (deals, campaigns, …) carry `projectId` — that
 * link is the matrix: filter by project for the project lens, omit it
 * (and group by project) for the company-wide department lens. Accounts &
 * contacts are the shared CRM layer (workspace-wide) that Sales and Marketing
 * both read from (HubSpot-style). Enum-like columns are plain text validated in
 * the app (see src/lib/departments.ts), matching the issues/status convention.
 */

/** Shared CRM layer: companies / organisations. */
export const crmAccounts = pgTable(
  "crm_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    website: text("website"),
    industry: text("industry"),
    type: text("type").notNull().default("prospect"), // prospect | customer | partner | churned
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    entity: text("entity").notNull().default("Global"), // India | Netherlands | Global
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("crm_accounts_ws_idx").on(t.workspaceId)],
);

/** Shared CRM layer: people at accounts (leads/prospects/customers). */
export const crmContacts = pgTable(
  "crm_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => crmAccounts.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email"),
    title: text("title"),
    phone: text("phone"),
    lifecycleStage: text("lifecycle_stage").notNull().default("lead"), // lead | qualified | customer
    source: text("source"), // where the contact came from (campaign, referral, …)
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    entity: text("entity").notNull().default("Global"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("crm_contacts_ws_idx").on(t.workspaceId)],
);

/** Sales pipeline: a deal/opportunity, scoped to one project. */
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    accountId: uuid("account_id").references(() => crmAccounts.id, {
      onDelete: "set null",
    }),
    contactId: uuid("contact_id").references(() => crmContacts.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    stage: text("stage").notNull().default("lead"), // lead|qualified|proposal|negotiation|won|lost
    value: integer("value").notNull().default(0),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    expectedClose: timestamp("expected_close", { withTimezone: true }),
    entity: text("entity").notNull().default("Global"),
    // Fractional sort key for ordering within a pipeline column.
    sortKey: text("sort_key").notNull().default("a0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deals_ws_idx").on(t.workspaceId),
    index("deals_project_idx").on(t.projectId),
  ],
);

/** CRM/Sales timeline entry (note, call, email, task, meeting). */
export const crmActivities = pgTable(
  "crm_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    accountId: uuid("account_id").references(() => crmAccounts.id, {
      onDelete: "cascade",
    }),
    contactId: uuid("contact_id").references(() => crmContacts.id, {
      onDelete: "cascade",
    }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("note"), // note|call|email|task|meeting
    body: text("body"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    done: boolean("done").notNull().default(false),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("crm_activities_ws_idx").on(t.workspaceId),
    index("crm_activities_deal_idx").on(t.dealId),
  ],
);

/** Marketing campaign, scoped to one project. */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    channel: text("channel").notNull().default("email"), // email|linkedin|events|content|paid|referral
    status: text("status").notNull().default("planned"), // planned|active|done
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    budget: integer("budget").notNull().default(0),
    // Outcome metrics (e.g. WhatsApp reach / replies / conversions).
    reach: integer("reach").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    entity: text("entity").notNull().default("Global"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("campaigns_ws_idx").on(t.workspaceId),
    index("campaigns_project_idx").on(t.projectId),
  ],
);

/** Marketing content-calendar item, optionally attached to a campaign. */
export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    channel: text("channel"),
    status: text("status").notNull().default("idea"), // idea|draft|scheduled|published
    // Link to the actual deliverable (video URL, doc, sample report) + freeform notes/copy.
    url: text("url"),
    notes: text("notes"),
    publishDate: timestamp("publish_date", { withTimezone: true }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("content_items_ws_idx").on(t.workspaceId),
    index("content_items_project_idx").on(t.projectId),
  ],
);

export const crmAccountsRelations = relations(crmAccounts, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmAccounts.workspaceId],
    references: [workspaces.id],
  }),
  owner: one(users, { fields: [crmAccounts.ownerId], references: [users.id] }),
  contacts: many(crmContacts),
  deals: many(deals),
}));

export const crmContactsRelations = relations(crmContacts, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmContacts.workspaceId],
    references: [workspaces.id],
  }),
  account: one(crmAccounts, {
    fields: [crmContacts.accountId],
    references: [crmAccounts.id],
  }),
  owner: one(users, { fields: [crmContacts.ownerId], references: [users.id] }),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [deals.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, { fields: [deals.projectId], references: [projects.id] }),
  account: one(crmAccounts, {
    fields: [deals.accountId],
    references: [crmAccounts.id],
  }),
  contact: one(crmContacts, {
    fields: [deals.contactId],
    references: [crmContacts.id],
  }),
  owner: one(users, { fields: [deals.ownerId], references: [users.id] }),
  activities: many(crmActivities),
}));

export const crmActivitiesRelations = relations(crmActivities, ({ one }) => ({
  deal: one(deals, { fields: [crmActivities.dealId], references: [deals.id] }),
  account: one(crmAccounts, {
    fields: [crmActivities.accountId],
    references: [crmAccounts.id],
  }),
  contact: one(crmContacts, {
    fields: [crmActivities.contactId],
    references: [crmContacts.id],
  }),
  actor: one(users, { fields: [crmActivities.actorId], references: [users.id] }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [campaigns.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [campaigns.projectId],
    references: [projects.id],
  }),
  owner: one(users, { fields: [campaigns.ownerId], references: [users.id] }),
  content: many(contentItems),
}));

export const contentItemsRelations = relations(contentItems, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [contentItems.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [contentItems.projectId],
    references: [projects.id],
  }),
  campaign: one(campaigns, {
    fields: [contentItems.campaignId],
    references: [campaigns.id],
  }),
  owner: one(users, { fields: [contentItems.ownerId], references: [users.id] }),
}));

/**
 * ---- Finance (the 4th department module) ----
 *
 * Project-level revenue tracking: invoices (optionally tied to a CRM account)
 * and expenses. This is the coordination/P&L layer per project — the regulated
 * statutory books stay per-entity in external tools (see docs/ORG.md).
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    accountId: uuid("account_id").references(() => crmAccounts.id, {
      onDelete: "set null",
    }),
    number: text("number"),
    status: text("status").notNull().default("draft"), // draft|sent|paid|overdue
    amount: integer("amount").notNull().default(0),
    entity: text("entity").notNull().default("Global"),
    issueDate: timestamp("issue_date", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invoices_ws_idx").on(t.workspaceId),
    index("invoices_project_idx").on(t.projectId),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    vendor: text("vendor"),
    category: text("category").notNull().default("other"), // tooling|contractors|marketing|infra|other
    amount: integer("amount").notNull().default(0),
    status: text("status").notNull().default("planned"), // planned|paid
    entity: text("entity").notNull().default("Global"),
    spentDate: timestamp("spent_date", { withTimezone: true }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("expenses_ws_idx").on(t.workspaceId),
    index("expenses_project_idx").on(t.projectId),
  ],
);

export const invoicesRelations = relations(invoices, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [invoices.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
  account: one(crmAccounts, {
    fields: [invoices.accountId],
    references: [crmAccounts.id],
  }),
  owner: one(users, { fields: [invoices.ownerId], references: [users.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [expenses.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, { fields: [expenses.projectId], references: [projects.id] }),
  owner: one(users, { fields: [expenses.ownerId], references: [users.id] }),
}));

/**
 * ---- Support (the 5th department module) ----
 *
 * Zendesk/Intercom-style ticket queue, project-scoped, on the shared CRM layer:
 * a ticket can link to a CRM account/contact. Conversation lives in
 * ticket_comments.
 */
export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    accountId: uuid("account_id").references(() => crmAccounts.id, {
      onDelete: "set null",
    }),
    contactId: uuid("contact_id").references(() => crmContacts.id, {
      onDelete: "set null",
    }),
    subject: text("subject").notNull(),
    body: text("body"),
    status: text("status").notNull().default("open"), // open|pending|solved|closed
    priority: text("priority").notNull().default("normal"), // urgent|high|normal|low
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    requesterEmail: text("requester_email"),
    entity: text("entity").notNull().default("Global"),
    sortKey: text("sort_key").notNull().default("a0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tickets_ws_idx").on(t.workspaceId),
    index("tickets_project_idx").on(t.projectId),
  ],
);

export const ticketComments = pgTable(
  "ticket_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ticket_comments_ticket_idx").on(t.ticketId)],
);

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [tickets.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, { fields: [tickets.projectId], references: [projects.id] }),
  account: one(crmAccounts, {
    fields: [tickets.accountId],
    references: [crmAccounts.id],
  }),
  contact: one(crmContacts, {
    fields: [tickets.contactId],
    references: [crmContacts.id],
  }),
  assignee: one(users, { fields: [tickets.assigneeId], references: [users.id] }),
  comments: many(ticketComments),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketComments.ticketId], references: [tickets.id] }),
  author: one(users, { fields: [ticketComments.authorId], references: [users.id] }),
}));

/**
 * ---- Milestones (project phases: MVP / v1.0 / Phase 1) ----
 *
 * A dated, named checkpoint *within* a project that bundles features toward a
 * release. Sits between Project and Feature: Project → Milestone → Feature →
 * Issue. Progress rolls up from the issues under the milestone's features.
 */
export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    targetDate: timestamp("target_date", { withTimezone: true }),
    sortKey: text("sort_key").notNull().default("a0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("milestones_project_idx").on(t.projectId)],
);

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [milestones.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
  features: many(features),
  issues: many(issues),
}));

// ---- Org chart: positions/roles a person can hold ----
// Decoupled from workspaceMembers.managerId so one person can hold several
// positions (e.g. a founder who is both CEO and CTO). The tree is built from
// parentId (app-managed, like pages). userId is nullable for an open seat.
export const orgRoles = pgTable(
  "org_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    parentId: uuid("parent_id"),
    sortKey: text("sort_key").notNull().default("a0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("org_roles_workspace_idx").on(t.workspaceId)],
);

export const orgRolesRelations = relations(orgRoles, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [orgRoles.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [orgRoles.userId],
    references: [users.id],
  }),
}));

// ---- Features department (PM unit above engineering issues) ----
export const features = pgTable(
  "features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    // The release phase this feature belongs to (null = unscheduled).
    milestoneId: uuid("milestone_id").references(() => milestones.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: text("status").notNull().default("idea"), // idea|planned|building|shipped|archived
    startDate: timestamp("start_date", { withTimezone: true }),
    targetDate: timestamp("target_date", { withTimezone: true }),
    spec: jsonb("spec"),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    sortKey: text("sort_key").notNull().default("a0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("features_ws_idx").on(t.workspaceId),
    index("features_project_idx").on(t.projectId),
    index("features_milestone_idx").on(t.milestoneId),
  ],
);

export const featuresRelations = relations(features, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [features.workspaceId], references: [workspaces.id] }),
  project: one(projects, { fields: [features.projectId], references: [projects.id] }),
  milestone: one(milestones, {
    fields: [features.milestoneId],
    references: [milestones.id],
  }),
  owner: one(users, { fields: [features.ownerId], references: [users.id] }),
  page: one(pages, { fields: [features.pageId], references: [pages.id] }),
  issues: many(issues),
}));

/**
 * ---- Analytics department: product metrics ----
 *
 * A `metric` is a KPI definition (north-star, activation, retention, …) scoped
 * to a project; `metric_points` are its time-series values. Charts read from
 * points; cards show the latest point + delta vs the previous one.
 */
export const metrics = pgTable(
  "metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit"), // e.g. "users", "%", "€", "/5"
    cadence: text("cadence").notNull().default("monthly"), // weekly | monthly | quarterly
    isNorthStar: boolean("is_north_star").notNull().default(false),
    sortKey: text("sort_key").notNull().default("a0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("metrics_ws_idx").on(t.workspaceId),
    index("metrics_project_idx").on(t.projectId),
  ],
);

export const metricPoints = pgTable(
  "metric_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metricId: uuid("metric_id")
      .notNull()
      .references(() => metrics.id, { onDelete: "cascade" }),
    periodDate: timestamp("period_date", { withTimezone: true }).notNull(),
    value: real("value").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("metric_points_metric_idx").on(t.metricId)],
);

export const metricsRelations = relations(metrics, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [metrics.workspaceId], references: [workspaces.id] }),
  project: one(projects, { fields: [metrics.projectId], references: [projects.id] }),
  points: many(metricPoints),
}));

export const metricPointsRelations = relations(metricPoints, ({ one }) => ({
  metric: one(metrics, { fields: [metricPoints.metricId], references: [metrics.id] }),
}));

/**
 * ---- Product department: feedback (discovery / voice-of-customer) ----
 *
 * Feature requests, interview notes and insights scoped to a project. A
 * feedback item can link to the roadmap `feature` it informs — that link is the
 * discovery → roadmap loop.
 */
export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    source: text("source").notNull().default("customer"), // customer|sales|support|interview|internal|other
    status: text("status").notNull().default("new"), // new|reviewing|planned|declined|shipped
    votes: integer("votes").notNull().default(1),
    contact: text("contact"), // who / where it came from
    featureId: uuid("feature_id").references(() => features.id, { onDelete: "set null" }),
    sortKey: text("sort_key").notNull().default("a0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("feedback_ws_idx").on(t.workspaceId),
    index("feedback_project_idx").on(t.projectId),
  ],
);

export const feedbackRelations = relations(feedback, ({ one }) => ({
  workspace: one(workspaces, { fields: [feedback.workspaceId], references: [workspaces.id] }),
  project: one(projects, { fields: [feedback.projectId], references: [projects.id] }),
  feature: one(features, { fields: [feedback.featureId], references: [features.id] }),
}));
