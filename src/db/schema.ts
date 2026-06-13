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
    // Fractional sort key for ordering siblings in the page tree.
    position: text("position").notNull().default("a0"),
    creatorId: uuid("creator_id").references(() => users.id, {
      onDelete: "set null",
    }),
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

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
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
  assignee: one(users, {
    fields: [issues.assigneeId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [issues.creatorId],
    references: [users.id],
  }),
  labels: many(issueLabels),
  pageLinks: many(issuePageLinks),
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
