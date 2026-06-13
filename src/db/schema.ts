import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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
    role: text("role").notNull().default("member"), // member | admin
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

/** Strategic groupings that contain projects (Linear-style initiatives). */
export const initiatives = pgTable("initiatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // planned | active | completed
  color: text("color").notNull().default("#8b5cf6"),
  targetDate: timestamp("target_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
    color: text("color").notNull().default("#6366f1"),
    initiativeId: uuid("initiative_id").references(() => initiatives.id, {
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
    name: text("name").notNull(),
    number: integer("number").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cycles_workspace_idx").on(t.workspaceId)],
);

/** Sub-teams within a workspace (Linear-style teams). */
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull(),
    color: text("color").notNull().default("#6366f1"),
    icon: text("icon").notNull().default("👥"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("teams_workspace_key_idx").on(t.workspaceId, t.key)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
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
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    // Self-reference for sub-issues; null = top-level issue.
    parentId: uuid("parent_id"),
    // Per-project incrementing number, combined with project key for display.
    number: integer("number").notNull(),
    title: text("title").notNull(),
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

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
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

export const initiativesRelations = relations(initiatives, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [initiatives.workspaceId],
    references: [workspaces.id],
  }),
  projects: many(projects),
}));

export const cyclesRelations = relations(cycles, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [cycles.workspaceId],
    references: [workspaces.id],
  }),
  issues: many(issues),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [teams.workspaceId],
    references: [workspaces.id],
  }),
  members: many(teamMembers),
  issues: many(issues),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  initiative: one(initiatives, {
    fields: [projects.initiativeId],
    references: [initiatives.id],
  }),
  issues: many(issues),
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
  team: one(teams, {
    fields: [issues.teamId],
    references: [teams.id],
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
