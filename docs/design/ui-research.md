# Best work tools trade chrome for density

The best work-management tools of 2025-2026 follow the same formula. Lists come before dashboards, exceptions before inventory, the keyboard before the mouse, and the visual system is close to monochrome, with color reserved for state. **Linear lands people on one list of their assigned issues, ordered by "what to work on first."** **Attio's home shows only tasks due today, tomorrow or overdue.** Even the most customizable tools (ClickUp, Asana, Notion) keep the personal task list fixed in place, and none of the reviewed homes documents stat charts. For a cross-project view, the pattern is a dense table grouped by container (team, product, department). Lifecycle status is kept separate from an **On track / At risk / Off track health** value, which only a posted update can set and which visibly decays when updates go stale. A single "Display" popover reconfigures the view, and a project opens in a side peek before it opens as a full page. The reference design systems (Linear, Vercel Geist, Attio) share these traits:

- **13px UI text** at weights around **400/500/600** on a **4px grid**;
- surfaces built from a low-chroma gray ramp plus **one accent**;
- structure drawn with **5-10% alpha borders**;
- layered shadows at **≤6% opacity**, used only on floating layers.

The most-starred GitHub UI skills are anthropics/skills (~188K stars; its `frontend-design` skill has ~1.1M installs), ui-ux-pro-max (~146K), taste-skill (~111K) and impeccable (~105K). They agree on a hard quality floor: visible focus, reduced motion, animating only transform and opacity, tabular numbers, skeleton loaders, designed empty states and one accent color. They also share a list of "AI slop" tells to avoid, and they disagree on matters of taste that a team must settle once. The report ends with a prioritized spec: tokens and component states first, then Home and Projects, then the keyboard and inline-editing layer.

## Home answers three questions, and only the task list is non-negotiable

Every tool studied splits the personal landing area along the same three questions: what have I committed to, what is waiting on my response, and where was I.

- **Committed work:** Linear's My Issues, Jira's Assigned to me, Asana's and ClickUp's My tasks, monday's My Work, and Attio's Home task list.
- **Waiting on my response:** Linear's Inbox, and Jira's "Reply to mentions" and "Approve waiting work" prompts.
- **Where I left off:** Jira's Worked on and Viewed tabs, the Recents sections in Plane and Notion, and Linear's Activity tab.

Sources: [Linear Docs: My Issues](https://linear.app/docs/my-issues), [Atlassian Support: For you](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-for-you-page/), [Notion Help](https://www.notion.com/help/home-and-my-tasks).

Inside the committed-work list, two ordering philosophies compete. **Linear orders by priority.** Its default Assigned tab uses a "Focus" grouping in this order: urgent work, SLA-bound work, issues blocking others, current-cycle work, other active work, triage, backlog, completed. A group appears only when it has items, and within a group issues sort by priority with started work first ([Linear Docs: My Issues](https://linear.app/docs/my-issues)). **monday, ClickUp and Attio order by time.** monday's My Work groups items into Past dates, Today, This week, Next week, Later and Without a date, with a count beside each group ([monday Support](https://support.monday.com/hc/en-us/articles/9516773224466-My-work-new-layout)). Attio's home is deliberately narrow: assigned tasks due today, tomorrow or overdue, plus "View all" and "+" ([Attio Help: Tasks](https://attio.com/help/reference/productivity-collaborating/tasks)). Both philosophies put overdue or urgent work first.

| Tool | Landing surface | Default ordering | What surrounds the list |
|---|---|---|---|
| Linear | My Issues (Assigned / Created / Subscribed / Activity); no dashboard | Focus: urgent → SLA → blocking → cycle → active → triage → backlog | Inbox is a separate sidebar item above it; Pulse feed with AI digest ([Linear Pulse](https://linear.app/changelog/2025-04-16-pulse)) |
| Jira | "For you" (renamed from "Your work") | Recommended feed first, then Assigned to me, Starred, Worked on, Viewed | Recommended spaces strip; action-prompt cards; AI agent-activity card ([Atlassian](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-for-you-page/)) |
| Attio | Home tasks | Due today / tomorrow / overdue only | View all, +, and a `t` hotkey anywhere ([Attio](https://attio.com/help/reference/productivity-collaborating/tasks)) |
| monday | My Work | Past dates → Today → This week → Next week → Later → Without a date | Counts per group ([monday](https://support.monday.com/hc/en-us/articles/9516773224466-My-work-new-layout)) |
| ClickUp 4.0 | Today & Overdue page | Today, Overdue, Next, Unscheduled | My Work and Agenda cards that "cannot be moved, resized, or removed" ([ClickUp Help](https://help.clickup.com/hc/en-us/articles/31007956275863-My-Tasks)) |
| Plane | Home | Greeting, then widgets | Quicklinks, Recents, Stickies; widgets can be toggled ([Plane Docs](https://docs.plane.so/core-concepts/account/overview)) |
| Asana / Notion | Customizable Home | Widgets or reorderable sections | Notepad, recent projects, favorites, agents ([Asana](https://asana.com/features/project-management/home); [Notion](https://www.notion.com/help/home-and-my-tasks)) |

The widget-heavy homes (Asana, Notion, Plane, ClickUp) serve broad, horizontal audiences. The specialist tools, engineering-focused Linear and CRM-focused Attio, keep the home to a single list. **ClickUp's decision to lock My Work and Agenda in place is telling: even a tool built for customization will not let the task list move.** None of the research found usage data showing that widget homes beat list-only homes, so that question remains open. For an internal tool that mixes tasks, projects, docs and CRM, the evidence favors the minimal end: one list plus at most two secondary panels, typically "needs my reply" and "recent." The 2025-2026 direction adds ranked, action-oriented feeds and AI entry points: Jira's agent card, Notion's "Agents" section and Linear's audio "Daily Pulse." In every tool those sit beside the assigned list, never in place of it.

Two documented failures shape the details.

**monday's "Later" bucket gets swamped.** It can hold more than 1,000 items, and users reported that above the 1,000-item limit only "Later" items appeared. They have asked for Later to be split by month and for "Without a date" to move to the top ([monday Community](https://community.monday.com/t/my-work-prioritizes-later-category-instead-of-overdue-or-this-week-when-over-1000-items-limit/54646)). The lesson: collapse and cap the tail bucket, and place "No date" deliberately.

**Asana dropped automatic promotion between sections.** In 2021 Asana stopped auto-promoting tasks between Today, Upcoming and Later in My Tasks and replaced the behavior with user-defined Rules ([Asana](https://asana.com/inside-asana/customize-my-tasks)). The safest design derives buckets live from due dates, so that no task silently changes stored state.

On tone, Plane greets users with "Good morning" plus the date ([Plane Docs](https://docs.plane.so/core-concepts/account/overview)). The unslop skill flags "Welcome back, Damir! 👋" as AI slop and prescribes "the page or period as the title" instead ([unslop signs.md](https://raw.githubusercontent.com/heydamir/unslop/main/skills/unslop/references/signs.md)). A plain "My work" title with today's date is the better choice for a tool people open fifty times a day.

No vendor documents its row height or left-to-right property order. Linear exposes about twenty toggleable row properties (ID, status, assignee, priority, project, due date, labels, cycle, estimate and more) without stating its defaults ([Linear Docs: Display options](https://linear.app/docs/display-options)). The defensible default row for a personal list therefore draws on two observations. Assignee is redundant when every task is yours. A project chip is mandatory because the list aggregates across containers, which is why monday and Jira surface the board or space on every item. The resulting row is: status glyph, priority glyph, ID, title, project chip, due date. For quick-add, the benchmark is Attio's `t`-anywhere shortcut, backed by a "+" on the widget and a "Create task" command in Cmd/Ctrl+K ([Attio Help](https://attio.com/help/reference/productivity-collaborating/tasks)). Empty-state copy is almost entirely undocumented. The only verbatim example found was Plane's "It's Quiet Without Widgets, Turn Them On."

## Project portfolios keep health apart from status and let it decay

Every serious tool offers the same layouts for many projects: list or table, board, and timeline. **The dense list is always the primary surface**, and none of the tools studied makes cards the default portfolio view. Linear shows workspace projects as list, board or timeline, and lets custom views attach to the Projects page as tabs ([Linear Docs: Projects](https://linear.app/docs/projects)). Attio offers exactly two view types, table and kanban ([Attio Help](https://attio.com/help/reference/managing-your-data/views/create-and-manage-table-views)). The columns converge too: name with icon, lifecycle status, health, progress, lead, target date, priority and last update. monday's Enterprise portfolio makes **Owner, Project Health and Project Progress mandatory columns that cannot be removed** ([monday Support](https://support.monday.com/hc/en-us/articles/13337066797202-The-portfolio-solution)). That rule is worth copying, because it forces every project in a unified view to answer the same three questions. Linear lets target dates be set at quarter, half-year or year granularity, so planning can stay honestly fuzzy ([Linear Docs: Projects](https://linear.app/docs/projects)).

Progress is always derived from completed child items, never typed in. Plane renders it best: a **segmented bar plus one tile per state group** (Backlog, Unstarted, Started, Completed, Cancelled), each showing a count and a percentage. Clicking a tile opens that project's work items filtered to that group ([Plane Docs: Project overview](https://docs.plane.so/core-concepts/projects/project-overview)). The segments explain *why* progress is low, not just that it is. Jira Plans adds an honesty cue: **a bar that fades out in one direction signals that rolled-up dates are incomplete**, meaning some children have no dates ([Atlassian](https://support.atlassian.com/jira-software-cloud/docs/how-advanced-roadmaps-rolls-up-dates/)).

Health has converged on a three-value set, **On track / At risk / Off track**, shown in green, yellow and red, with grey for "no current update" ([Linear Docs: Initiatives](https://linear.app/docs/initiatives)). It stays separate from lifecycle status such as Planned, In progress or Completed. Linear has the most precise model for staleness:

- **Reminders and nudges.** Reminders go to the project lead on a cadence set by an admin. If no update arrives, nudges follow one working day later and again two working days after that.
- **"Update Missing".** A project whose last update said On track is marked "Update Missing" once it is **overdue by one reminder cycle plus three days**.
- **Visual decay.** A dashed outline marks an update that is slightly overdue. The health icon turns grey after extended inactivity.
- **"No Update expected".** Completed projects, and projects whose reminders are set to "Never", show this instead ([Linear Docs: Updates](https://linear.app/docs/initiative-and-project-updates)).

The alternatives are cruder. Asana's portfolio Status field reportedly stops showing an update after about three months ([Asana Forum](https://forum.asana.com/t/status-update-not-reflected-in-portfolio/847784)). Atlassian pushes a Monday digest of project updates ([Atlassian Support](https://support.atlassian.com/platform-experiences/docs/follow-goals-projects-teams-and-topics/)). Linear's approach of keeping the stale status visible but visibly degraded is the most informative in a dense table, because it never shows a confident green that nobody has checked in months. The cadence should be set per project: weekly by default, and "Never" for back-office operations that run continuously.

Reconfiguration lives in **one Display popover, opened in Linear with Shift+V**. It holds layout, grouping, ordering, how many completed projects to show (last week, month or year, all, or none) and which properties are visible. Changes stay personal until someone clicks **"Set as default"**, and "Reset to default" reverts them ([Linear Docs: Display options](https://linear.app/docs/display-options)). Attio follows the same personal-until-saved rule ([Attio Help](https://attio.com/help/reference/managing-your-data/views/create-and-manage-table-views)). In a shared internal tool, this rule prevents one person's tweak from rearranging everyone's view.

The grouping axis that matters most for a company organized by product and department is grouping by container. That is exactly what ClickUp users have long requested and still lack ([ClickUp feedback](https://feedback.clickup.com/feature-requests/p/group-by-space)). The right design is a two-level Product → Department grouping, with department tabs implemented as saved views rather than as separate pages.

Opening a project is a two-step move. **Space opens a peek** showing details and the progress graph, and the full page carries the deep work ([Linear Docs: Peek](https://linear.app/docs/peek)). Linear's 2024 project overview puts these on the page:

- a top row with status, lead, members, target date and a one-line description;
- linked documents and links;
- a rich-text description and milestones;
- the latest update, with history in an Updates tab ([Linear changelog](https://linear.app/changelog/2024-05-02-the-next-generation-of-linear-projects)).

Plane pairs Overview and Milestones tabs with a right-hand Properties / Updates / Activity panel ([Plane Docs](https://docs.plane.so/core-concepts/projects/project-overview)).

For the leadership view, every tool adds a **separate layer above projects rather than more columns**:

- Linear Initiatives roll each child project's health into an "Active Projects" column.
- Linear Pulse custom feeds can show, for example, only Off-track work ([Linear changelog](https://linear.app/changelog/2025-05-15-custom-feeds-in-pulse)).
- monday's Risk Insights shows a count of at-risk projects ([monday Support](https://support.monday.com/hc/en-us/articles/22551628427666-The-portfolio-Risk-Insights)).

The practical translation is a collapsible pulse strip showing health counts and the latest updates, plus a pre-saved "Needs attention" view (At risk + Off track + Update missing).

## Thirteen-pixel text, a gray ramp and one accent carry the visual system

### Type: a 13px workhorse, three weights, and tracking that tightens with size

Typography values were measured from the production CSS of linear.app, vercel.com/geist and attio.com on 2026-11-06. One caveat applies: the Linear and Attio values come from their marketing sites, because the logged-in apps need an account. Treat in-app row sizes as inferred, not measured.

**Linear** sets Inter Variable at the unusual weights **400 / 510 / 590**. Its "mini" text style is **13px with a 1.5 line height and -0.01em tracking**, and every title style uses weight 590 ([linear.app stylesheets](https://linear.app/)). The 2024 redesign added **Inter Display for headings only** ([Linear: How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)). Attio also pairs Inter with Inter Display ([attio.com](https://attio.com/)).

**Geist** is the most explicit about roles. Label 14 is "the most common text style, used in many menus." Label 13 is for secondary lines, with tabular numbers. Label 12 is "tertiary text in busy views." Heading tracking runs about **-0.02em at 14-20px, -0.04em at 24-32px and -0.06em at 40px and up** ([Geist Typography](https://vercel.com/geist/typography)).

impeccable's guidance for app surfaces, which it calls "Operate" mode, agrees: "One family is often right," on a "fixed rem scale, not fluid" with a **1.125-1.2 ratio between steps** ([impeccable operate.md](https://raw.githubusercontent.com/pbakaus/impeccable/main/.agents/skills/impeccable/reference/operate.md)).

The synthesis:

- **Sizes:** 13px for rows, menus and property values; 14px for body copy and inputs; 16px for section titles; 20px for page titles.
- **Weights:** 400, 500 and 600, never 700 in app chrome.
- **Tracking:** zero at 12px and below; tighten only as size grows.
- **Exception:** inputs on mobile must be at least 16px to avoid iOS auto-zoom ([Vercel Web Interface Guidelines](https://vercel.com/design/guidelines)).

### Space: a 4px grid and tighter radii than shadcn ships

All three systems use a 4px base unit. Geist fixes control heights at **32 / 36 / 40px** and uses a **6px base radius** ([Geist stylesheet](https://vercel.com/geist/typography)). Linear's radius scale is 4 / 6 / 8 / 12 / 16 / 24 / 32px plus a pill, and its marketing CSS declares a 232px sidebar width ([linear.app stylesheets](https://linear.app/)). shadcn/ui defaults to `--radius: 0.625rem` (10px) ([shadcn Theming](https://ui.shadcn.com/docs/theming)), which is visibly rounder and more consumer-like than either reference.

Linear's March 2026 refresh moved further toward compactness. Tabs are "more compact, not full width." Icons were "reduced in usage, scaled down." Colored team-icon backgrounds were removed ([Linear: Behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh)). Vercel sets the minimum hit area: expand anything smaller than 24px to at least 24px, or 44px on touch. Its guidelines also require nested radii to be concentric, with a child's radius never larger than its parent's ([Vercel Guidelines](https://vercel.com/design/guidelines)). No source publishes in-app icon sizes or stroke widths. The common pairing of 16px icons inside 28-32px controls is a recommendation, not a measurement.

### Color: one gray ramp, alpha borders, one accent

**Linear builds its UI almost entirely from neutrals:**

- four background levels, from `#08090a` to `#191a1b` in dark mode;
- three border levels plus translucent 5% and 8% borders;
- four text levels;
- **one indigo accent, `#5e6ad2`, which is also the focus-ring color;**
- status hues (blue, green, orange, red, yellow, teal) kept for small glyphs ([linear.app stylesheets](https://linear.app/)).

Linear's design history explains the restraint. In 2024 it moved theme generation to **LCH, cutting each theme from 98 hand-set variables to three inputs (base, accent, contrast)** ([Linear 2024](https://linear.app/now/how-we-redesigned-the-linear-ui)). In 2026 it warmed the grays, dimmed the sidebar "a few notches," and adopted two principles: **"Don't compete for attention you haven't earned"** and "Structure should be felt not seen" ([Linear 2026](https://linear.app/now/behind-the-latest-design-refresh)).

Geist and Radix formalize the ramp as roles. In Geist, step 100 is the default background, 200 hover, 300 active, 400-600 borders, 900 secondary text and 1000 primary text ([Geist Colors](https://vercel.com/geist/colors)). Radix guarantees that its text steps 11 and 12 reach **APCA Lc 60 and Lc 90** on its step-2 background ([Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)).

Copying Linear blindly has a contrast cost. Computed from Linear's own hex values, its fourth text tier ("quaternary") reaches only **3.7:1 on white and 3.45:1 on dark, below the WCAG AA threshold of 4.5:1**, while its third tier passes at 5.0:1 and 6.1:1 ([linear.app stylesheets](https://linear.app/); [WCAG 2.2](https://www.w3.org/TR/WCAG22/)). The usable targets come from APCA: **Lc 90 preferred for body text, Lc 75 minimum, Lc 60 for secondary content, Lc 45 for icons, Lc 30 as the floor for any text, and Lc 15 for dividers** ([APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)).

### Elevation: borders in flow, shadows only when floating

Geist draws borders as a 1px box-shadow ring at 8% black and combines them with multi-layer shadows of **at most 6% alpha**, used on menus and modals ([Geist stylesheet](https://vercel.com/geist/typography)). Vercel's guidelines ask for shadows with "at least two layers" and semi-transparent borders ([Vercel Guidelines](https://vercel.com/design/guidelines)). Some Linear themes turn shadows off entirely and rely on lighter surfaces in dark mode ([linear.app stylesheets](https://linear.app/)).

impeccable states the discipline bluntly: "Declare elevation once, border or shadow. A 1px border under a wide soft shadow is the ghost card" ([impeccable craft-floor.md](https://raw.githubusercontent.com/pbakaus/impeccable/main/.agents/skills/impeccable/reference/craft-floor.md)). The two positions reconcile cleanly. Surfaces that sit in the page flow, such as rows, panels and the rare card, get a hairline border and no shadow. Floating layers (popovers, menus, dialogs, toasts) get the ring plus a layered low-alpha shadow. In dark mode, depth comes from lightness steps rather than shadows.

### Why some UIs feel text-heavy

The remaining gap between "dense" and "text-heavy" is hierarchy. Text-heavy screens tend to:

- spell out state in words ("Status: In progress");
- repeat labels on every row;
- give titles and metadata equal weight;
- separate everything with dividers;
- print full timestamps.

Scannable screens do the opposite:

- show state as colored glyphs;
- state labels once, in a column header;
- keep text to two or three contrast tiers;
- use fewer dividers;
- align numbers in tabular figures;
- let each user choose which properties appear on a row, through Linear-style "display properties" that never remove items ([Linear Display options](https://linear.app/docs/display-options)).

Emil Kowalski adds a concrete date rule: switch relative timestamps to absolute dates after a week ([Emil cheatsheet](https://raw.githubusercontent.com/emilkowalski/skills/main/ui-cheatsheet.md)).

## Keyboard-first means zero animation where hands repeat

Linear has the de facto standard keyboard model, which comes in three groups.

- **List navigation and selection** ([Linear Docs: Select issues](https://linear.app/docs/select-issues)):
  - J/K or the arrow keys move the highlight; X selects the highlighted issue.
  - Shift+↑/↓ extends the selection; Cmd/Ctrl+A selects all; Esc clears.
  - Cmd/Ctrl+K opens the command menu; right-click opens a context menu.
  - P changes priority on the whole selection, and a bulk-action bar appears at the bottom.
- **Moving around** ([Linear Docs](https://linear.app/docs/my-issues)):
  - G then M jumps to My Issues; G then I jumps to Inbox.
- **Views and previews** ([Linear Display options](https://linear.app/docs/display-options); [Linear Peek](https://linear.app/docs/peek)):
  - Shift+V opens display options; Cmd/Ctrl+B toggles list and board.
  - Space toggles a peek of the focused item, and holding Space shows it only while pressed.
  - J/K keeps moving while the peek follows.
  - In the command menu, the right arrow shows a quick-look preview.

Attio's single-key `t` creates a task from anywhere ([Attio Help](https://attio.com/help/reference/productivity-collaborating/tasks)). ui-ux-pro-max's reasoning profile for productivity tools lists keyboard shortcuts as a `must_have` constraint ([ui-reasoning.csv](https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/data/ui-reasoning.csv)).

Inline editing follows from the keyboard model. Every property chip on a row or in a detail panel is a button. It opens a searchable picker anchored to the chip and is mirrored by a single-letter shortcut when the row is focused. Writes apply optimistically. Vercel's rule is "On failure, roll back the change or offer Undo," mutations should complete in under 500ms, and destructive actions need a confirmation or an undo window, "never immediate" ([Vercel Guidelines](https://vercel.com/design/guidelines)). Hallmark sharpens this to **"Undo over confirm"**: reversible actions run at once with Undo available for 5-10 seconds, while irreversible ones keep a confirmation in which the user types the item's name ([Hallmark](https://raw.githubusercontent.com/Nutlope/hallmark/main/skills/hallmark/references/interaction-and-states.md)).

Motion is the clearest place where admired tools diverge from generic output. **Emil Kowalski's frequency rule** sets the policy:

| How often users see it | Decision |
|---|---|
| 100+ times a day (keyboard shortcuts, command palette) | "No animation. Ever." |
| Tens of times a day (hover, list navigation) | Remove it or drastically reduce it |
| Occasionally (modals, drawers, toasts) | Standard animation |
| Rarely (onboarding, celebrations) | Delight allowed |

Emil adds "Never animate keyboard-initiated actions," and points to Raycast, whose command palette opens with no animation at all ([Emil Kowalski](https://emilkowal.ski/ui/great-animations)). Rauno Freiberg makes the same case: motion on actions repeated hundreds of times a day "does start to feel more like cognitive burden" ([Rauno](https://rauno.me/craft/interaction-design)).

The shipped timing tokens agree:

- **Linear:** quick transitions take 100ms and regular ones 250ms. **A hover highlight appears instantly (0ms) and fades out over 150ms** ([linear.app stylesheets](https://linear.app/)).
- **Geist:** popovers take 200ms; modals take 300ms and scale up from 0.96 ([Geist stylesheet](https://vercel.com/geist/typography)).
- **Emil Kowalski:** an ease-out curve of `cubic-bezier(0.23, 1, 0.32, 1)`; never ease-in; popovers grow from their trigger while modals stay centered; and a 0.97 scale on press.

Loading rules prevent flicker. Delay spinners and skeletons by **150-300ms**, then keep them visible for at least **300-500ms**. Skeletons should "mirror final content exactly" ([Vercel Guidelines](https://vercel.com/design/guidelines)), and spinners belong only inside buttons ([Hallmark](https://raw.githubusercontent.com/Nutlope/hallmark/main/skills/hallmark/references/interaction-and-states.md)). Focus rings are **2px with a 2px offset**, drawn in the accent color and applied with `:focus-visible` ([linear.app stylesheets](https://linear.app/); [Vercel Guidelines](https://vercel.com/design/guidelines)).

View state belongs in the URL. Vercel's guidelines say filters, tabs, pagination and expanded panels should live in query params, and suggest the nuqs library for this ([Vercel command.md](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)). For detail views, Notion has opened database items in a **side peek by default since July 2022**, keeping the list "visible and interactive on the left" ([Notion Releases](https://www.notion.com/releases/2022-07-20)). That same pattern lets J/K keep working while a detail panel is open.

## The most-starred agent skills share a quality floor and split on taste

Star counts were read from the GitHub API on 2026-11-06. Stars measure mindshare for a whole repo, and two of the leaders are collections, so install counts are the better signal for an individual skill. Even those deserve caution: the skills.sh leaderboard shows clusters of near-identical entries with 700K-980K installs each, which points to inflated counts ([skills.sh](https://skills.sh/)).

| Repo | Stars | Relevance to an internal app |
|---|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) (`frontend-design`) | 188,163 | Collection; `frontend-design` is the most-installed UI skill on skills.sh (#15, ~1.1M installs). Contributes the anti-slop clusters and copy rules |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 146,158 | Searchable CSV database: 192 product types, 74 font pairings, 119 UX guidelines, 22 stacks including shadcn |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 111,211 | Aimed at marketing sites; mostly useful for its bans |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 104,785 | Its Operate mode is the most directly applicable guidance for app UI |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) | 54,134 | Motion timing framework |
| [Nutlope/hallmark](https://github.com/Nutlope/hallmark) | 49,602 | Control states, forms, undo-over-confirm |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (`web-design-guidelines`) | 33,640 | ~833K installs; the most granular web-mechanics rules |
| [ibelick/ui-skills](https://github.com/ibelick/ui-skills) (`baseline-ui`) | 10,729 | Written for this stack: Tailwind, `cn`, Base UI/Radix |
| [heydamir/unslop](https://github.com/heydamir/unslop) | 10,712 | Fastest riser (~1,300 stars a day); dashboard copy rules |

For a work-management app, the most relevant guidance comes from impeccable, Vercel and ibelick.

- **impeccable** defines app surfaces as "Operate" mode, where "scanability, consistency, native expectations, and the real usage scene outrank expression." It proposes a "product slop test": "whether a category-fluent user can trust the interface immediately." It limits the accent to "primary actions, current selection, and state indicators only." It requires every interactive component to have seven states (default, hover, focus, active, disabled, loading, error). It also says, provocatively, that modals are "usually laziness" ([impeccable operate.md](https://raw.githubusercontent.com/pbakaus/impeccable/main/.agents/skills/impeccable/reference/operate.md)).
- **ibelick's baseline-ui** matches the stack:
  - use accessible primitives (Base UI, React Aria, Radix), and "NEVER mix primitive systems within the same interaction surface";
  - use `AlertDialog` for irreversible actions;
  - use `h-dvh`, never `h-screen`;
  - keep a fixed z-index scale;
  - use `tabular-nums` for data;
  - never use `useEffect` for anything that can be computed during render ([baseline-ui](https://raw.githubusercontent.com/ibelick/ui-skills/main/skills/baseline-ui/SKILL.md)).
- **Vercel** adds web mechanics:
  - hit targets of at least 24px;
  - virtualize lists longer than 50 items;
  - use `Intl` formatters for dates and numbers;
  - add "…" to menu items that open a follow-up step;
  - prefer APCA over WCAG 2 for contrast ([Vercel command.md](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)).

The consensus, stated by five or more skills, forms the floor:

- visible `:focus-visible` rings;
- native controls with labels;
- 4.5:1 contrast;
- `prefers-reduced-motion` honored;
- animate only transform and opacity, never `transition: all`;
- short, state-carrying motion (150-300ms);
- tabular numbers;
- skeletons that match the content's shape;
- empty states with one next action;
- errors next to the field;
- confirm or undo for destructive actions;
- a 4px spacing scale with semantic tokens;
- one accent.

Layered on top is a shared list of "AI-generated" tells to strip:

- purple-to-blue gradients and gradient text;
- emoji used as icons;
- cards nested inside cards;
- tracked ALL-CAPS eyebrow labels;
- grids of identical cards;
- "A · B · C" meta strings;
- a sparkline on every stat card;
- greeting headlines;
- sparkles marking AI features.

Sources: [Anthropic frontend-design](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md), [Hallmark](https://raw.githubusercontent.com/Nutlope/hallmark/main/skills/hallmark/SKILL.md), [unslop](https://raw.githubusercontent.com/heydamir/unslop/main/skills/unslop/references/signs.md).

ui-ux-pro-max is useful mainly as a lookup table, and its picks need judgment:

- **Productivity Tool row:** "Flat Design + Micro-interactions," a teal `#0D9488` and orange `#EA580C` palette, ~150ms quick actions, and complex onboarding and slow performance flagged as high-severity anti-patterns ([products.csv](https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/data/products.csv); [colors.csv](https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/data/colors.csv)).
- **CRM row:** a contact list with avatars, a pipeline kanban, an activity timeline, quick-log for calls and meetings, deal amounts, and "No shadows" with fast 150ms transitions. It maps cleanly onto a Sales/prospects module.
- **Caveats:** the palettes sit close to stock Tailwind values, and the general SaaS row recommends glassmorphism, which impeccable and unslop both flag as slop.

Where the skills disagree, consistency matters more than which side wins:

| Conflict | Positions | House decision for this app |
|---|---|---|
| Heading and button case | Vercel: Title Case, a self-described Vercel preference. Anthropic, Hallmark, unslop: sentence case | Sentence case everywhere |
| Uppercase or tracked labels | Banned by Anthropic, Hallmark, impeccable, unslop; interface-design's example uses one | None; group headers in 12-13px weight 500 |
| Monospace | Anthropic calls mono data labels a tell; impeccable allows it for real data; unslop suggests mono counts | Mono only for IDs and keycaps |
| Sidebar color | interface-design: same as the canvas. impeccable: a second neutral layer. Linear 2026: "a few notches dimmer" | One notch dimmer than content |
| Confirm or undo | ibelick and ui-ux-pro-max: AlertDialog. Hallmark and impeccable: undo first | Undo for reversible actions, typed confirmation for irreversible ones |
| Custom easing | ibelick: never unless requested. Emil: required | Define one ease-out token once and use only that |
| Body size | impeccable and ui-ux-pro-max: 16px floor "unless a dense role… justifies otherwise." interface-design: 14px | 13px for dense rows, 14px for body, 16px for mobile inputs and docs |

## A prioritized spec for Next.js 16, Tailwind v4 and shadcn on Base UI

The values below synthesize the evidence above. Where a number comes from a measured token, the earlier sections cite it. Where it is a judgment call (row heights, icon sizes, panel caps), treat it as a starting point to tune against the real product. Before wiring mutations or caching, check the APIs against `node_modules/next/dist/docs`, as the project's AGENTS.md requires.

### P0: foundations every screen inherits

| # | Decision | Concrete values |
|---|---|---|
| 1 | One neutral ramp, one accent | oklch neutrals at chroma ≈0.003-0.008 with one slightly warm hue. Put the brand hue only in `--primary`, `--ring` and a `--selected` tint. Use status hues only as 14-16px glyphs or 6-8px dots, never as row fills. No raw colors in components. |
| 2 | Three text tiers | `foreground` (≥Lc 90). `muted-foreground` (≥4.5:1 / ≈Lc 75), used for metadata and placeholders. `faint` for disabled text and decorative separators only. |
| 3 | Type scale | 11/16 badges · 12/16 timestamps · **13/20 rows, menus, properties** · 14/20 body, inputs, buttons · 16/24 section titles · 20/28 page titles · 24/32 rare. Weights 400/500/600 only. Tracking −0.01em at 13-15px, −0.02em at 16-20px, 0 at ≤12px. Inter Variable, with Inter Display at ≥20px (or Geist alone). `tabular-nums` on IDs, dates, counts and money. |
| 4 | Sizing on a 4px grid | Chips 24px; toolbar and sidebar items 28px; buttons and inputs 32px; settings forms 36px. List rows 32-36px for one line, 44-52px for two. Header 44-48px; sidebar ≈232px; page gutters 24px. Hit area ≥24px on desktop, ≥44px on touch. |
| 5 | Radius by nesting | Set `--radius: 0.5rem`, then override to exactly 4px (chips), 6px (buttons, inputs), 8px (popovers, cards), 12px (dialogs). A child's radius never exceeds its parent's. |
| 6 | One elevation rule | In-flow surfaces get a 1px alpha border and no shadow. Floating layers get a 1px ring plus a layered shadow at ≤6% alpha. Dark mode raises surfaces by about 0.02-0.03 L per level instead of adding shadow. |
| 7 | Focus and semantics | `focus-visible` 2px accent ring with a 2px offset (inset on inputs). `aria-label` on every icon button. `<button>` for actions, `<Link>` for navigation. `aria-live="polite"` on the toast region. Use `h-dvh`. |
| 8 | Motion budget | Hover background 0ms in, 150ms out. Popovers and menus 150-200ms ease-out, scaling 0.96→1 from the trigger's origin. Dialogs 200-250ms, centered. **No animation on the command palette, keyboard-opened menus or the J/K highlight.** Animate transform and opacity only; never `transition-all`. Reduced motion falls back to opacity only. |
| 9 | State floor | Every control has default, hover, focus, active, disabled, loading and error states. Skeletons mirror the real rows, appear after 150-300ms and stay at least 300-500ms. Spinners appear only inside buttons, and the button keeps its label. An empty state gives one line on what is empty, one line on why it matters, and one action. |

```css
/* globals.css: starting values. Tune hue and chroma once, then use tokens only. */
:root {
  --radius: 0.5rem;
  --background: oklch(0.995 0.002 80);
  --sidebar: oklch(0.975 0.003 80);          /* one notch dimmer than content */
  --muted: oklch(0.965 0.003 80);            /* row hover */
  --accent: oklch(0.955 0.004 80);           /* shadcn "accent" is a neutral hover surface */
  --foreground: oklch(0.25 0.006 80);
  --muted-foreground: oklch(0.52 0.008 80);  /* ≈5:1 on background; verify */
  --faint-foreground: oklch(0.66 0.006 80);  /* disabled/decorative only */
  --border: oklch(0 0 0 / 0.09);
  --border-subtle: oklch(0 0 0 / 0.05);      /* row dividers, "felt not seen" */
  --primary: oklch(0.55 0.15 260);           /* placeholder: your ONE accent */
  --ring: var(--primary);
  --selected: oklch(0.96 0.03 260);
  --elev-popover: 0 0 0 1px oklch(0 0 0 / 0.08), 0 1px 1px oklch(0 0 0 / 0.02),
                  0 4px 8px -4px oklch(0 0 0 / 0.04), 0 16px 24px -8px oklch(0 0 0 / 0.06);
}
.dark {
  --background: oklch(0.17 0.003 80);
  --sidebar: oklch(0.155 0.003 80);
  --card: oklch(0.195 0.003 80);
  --popover: oklch(0.215 0.004 80);
  --foreground: oklch(0.96 0.003 80);
  --muted-foreground: oklch(0.70 0.006 80);
  --border: oklch(1 0 0 / 0.10);
  --primary: oklch(0.66 0.14 260);
  --selected: oklch(0.25 0.04 260);
  --elev-popover: 0 0 0 1px oklch(1 0 0 / 0.12), 0 8px 24px -8px oklch(0 0 0 / 0.5);
}
@theme inline {
  --color-faint-foreground: var(--faint-foreground);
  --color-border-subtle: var(--border-subtle);
  --color-selected: var(--selected);
  --shadow-popover: var(--elev-popover);
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-xl: 12px;
}
@theme {
  --text-2xs: 0.6875rem; --text-2xs--line-height: 1rem;
  --text-xs: 0.75rem;    --text-xs--line-height: 1rem;
  --text-ui: 0.8125rem;  --text-ui--line-height: 1.25rem;   /* the workhorse */
  --text-sm: 0.875rem;   --text-sm--line-height: 1.25rem;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --default-transition-duration: 150ms;
  --default-transition-timing-function: var(--ease-out);
}
```

The placeholder values above have not been run through a contrast checker. Before shipping, check them against the APCA and WCAG targets in the Color section.

### P1: the two landing surfaces and the interaction layer

| # | Surface or pattern | Spec |
|---|---|---|
| 10 | **Home (`/`, "My work")** | **Header and tabs:** title "My work" plus today's date, no greeting. Tabs: Assigned (default), Created, Subscribed, Activity. **Main list:** your open tasks grouped by *derived* buckets, Overdue → Today → This week → Later → No date. Later stays collapsed after 20 rows with a "Show all N" link. Group headers are sticky and show counts. Sort by priority, with started tasks first; offer a "Focus" grouping (urgent → blocking → in progress → rest) as the alternative. **Row:** status glyph · priority glyph · ID (mono, faint) · title (truncated) · project/department chip · label dots · due date (relative, red only when overdue). No assignee. An inline "Add task" row ends each group and pre-fills that bucket's due date. **Right rail, two panels at most:** "Needs your reply" (mentions, approvals, and prospect follow-ups due by tomorrow; up to 5 items) and "Jump back in" (recent tasks, docs and projects; up to 5). |
| 11 | **Projects (`/projects`)** | **Views:** saved-view tabs All · My projects · Needs attention · one per department · Back office. The default list is grouped Product → Department. **Columns:** icon and name · status · health chip with its age · progress (segmented by state group, plus a tabular "7/12") · lead avatar · target (quarter or month allowed) · priority · last update (relative). **Health:** set only by posting an update. Cadence is per project (weekly default, "Never" for back office). It decays from solid, to a dashed outline once past due, to a grey "Update missing" at cadence + 3 days. **Above the list:** a collapsible pulse strip with health counts and the latest 3 updates. **Display popover (Shift+V):** layout (list, board, timeline), group, sub-group, order, show completed (week, month, year, all, none) and visible properties. Changes stay personal until "Set as default"; "Reset" reverts. Filters live in their own bar. |
| 12 | **Peek, then full page** | A click or Space opens a right side panel 480-640px wide. The list stays interactive, and J/K moves the peek. Enter opens the full page. **Project page:** a header properties row (status · health · lead · members · target · department), the latest-update card with its health and age, description and linked docs, milestones with progress, and tabs for Work items, Updates, Docs and Activity. Progress tiles deep-link to filtered work items. |
| 13 | **Command palette** | ⌘/Ctrl+K opens shadcn `Command` in a dialog with no open or close animation. Groups: Navigate, Create, and actions on the current selection. The right arrow previews the highlighted item. Show each command's shortcut as a keycap. |
| 14 | **Shortcuts** | J/K or ↑/↓ to move, X to select, Shift+↑/↓ to extend, Esc to clear. Space to peek, Enter to open, C to create. G-chords to jump (Home, Projects, Inbox, Sales). Shift+V for display options, ⌘/Ctrl+B to switch list and board. Single-letter property keys act on the focused row; confirm the exact letters against Linear's published shortcut list before shipping. `?` opens a cheat sheet. A bulk-action bar appears at the bottom once one or more rows are selected. |
| 15 | **Inline editing** | Each property chip is a `button` that opens a `Popover` + `Command` combobox anchored to the chip. Compose it with Base UI's `render` prop, not Radix's `asChild` ([shadcn.csv](https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/data/stacks/shadcn.csv)), and never mix Radix and Base UI primitives in the same surface. Writes are optimistic (`useOptimistic` plus a Server Action), should finish in under 500ms, and roll back with an error toast on failure. |
| 16 | **Undo before confirm** | Archive, move, reassign and trash run immediately and show a Sonner Undo toast for 5-10 seconds. Irreversible deletes use an `AlertDialog` that asks the user to type the item's name. The button verb matches the toast: "Archive" produces "Archived". Mount `<Toaster />` once, in the root layout. |
| 17 | **Hover reveal** | Row actions (More, Copy link, Open in new tab) are absolutely positioned so they never cause reflow. They fade from 0 to 1 on `:hover` and on `:focus-within`, so keyboard users can reach them. Gate hover styles with `@media (hover: hover) and (pointer: fine)`. Empty properties show "Add…" only on hover or focus. |

### P2: scale, the other modules, and house style

| # | Item | Spec |
|---|---|---|
| 18 | URL state | Keep tabs, filters, grouping and the open peek's ID in query params (nuqs), so every view deep-links and Back restores scroll position. |
| 19 | Long lists | Virtualize any list over 50 rows, or apply `content-visibility: auto`. |
| 20 | CRM prospects | Two views only: a table and a kanban by stage. Each view keeps its own filters and sorts, personal until saved. **Row:** avatar · company · stage · owner · next step with its due date · deal value (tabular). Every kanban drag has a menu or keyboard alternative ("Move to stage…"). Follow-ups feed the Home "Needs your reply" panel. |
| 21 | Docs | Use reading styles: 15-16px body text, 1.5-1.6 line height, a 65-75 character measure, `text-wrap: pretty` on body and `balance` on headings. Linked docs open in a side peek from project pages. |
| 22 | House style | **Case and labels:** sentence case everywhere, no tracked caps, mono only for IDs and keycaps. **Icons:** one icon family with one stroke, 16px in controls and 14px in chips. **Never use:** emoji icons, gradients, nested cards, or a grid of stat cards each carrying a sparkline. **Dates and numbers:** relative dates for the first week, then absolute; format everything with `Intl` and pluralize with `Intl.PluralRules`. |
| 23 | Later | A weekly AI digest of project updates delivered to the inbox (Pulse-style), and agent entry points on Home, added only once the core list is fast. |

## Conclusion

The thread running through every admired tool is **derived state shown honestly**. Due-date buckets are computed rather than stored. Progress comes from child items. Health is set only by a person's update and visibly degrades when nobody refreshes it. Group counts replace per-row repetition. The practical rule for this app follows: never display a value that no one maintains, and make staleness visible rather than hiding it. For a tool spanning tasks, projects, docs and CRM, the highest-leverage consistency move is building **one row anatomy, one property chip, one peek panel and one Display popover**, then reusing them across all four modules, so the product does not speak four visual dialects.

The skill ecosystem is best read as a floor, not a style. Its bans are heuristics against *unearned* defaults. Linear, the most admired reference, deliberately does several things the skills flag, including a tinted near-black background and monospace IDs, and it earns them through precision elsewhere. Three gaps remain:

- No vendor published in-app row heights or icon sizes.
- None of the research found usage data comparing widget homes with list homes.
- The Linear shortcut letters for property edits were not verified.

Treat those values as hypotheses to tune in the product, and treat the measured tokens, the staleness rules and the motion-frequency policy as settled.
