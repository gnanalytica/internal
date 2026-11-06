import { describe, expect, it } from "vitest";

import { ACTION_ASSIGN_ME, ACTION_SET_STATUS, type RecordSnapshot } from "./cards";
import {
  ACTION_COMMENT,
  ACTION_LOG_TOUCH,
  decodeTouchButton,
  encodeTouchButton,
  groupByStatus,
  mineCard,
  prospectFieldsOf,
  prospectsCard,
  readNewTaskValues,
  readTouchValues,
  searchResultsCard,
  taskCard,
  taskHeadline,
  type ProspectView,
  type TaskRow,
} from "./views";

const APP = "https://internal.gnanalytica.com";
const task = (over: Partial<TaskRow> = {}): TaskRow => ({
  id: "11111111-1111-1111-1111-111111111111",
  number: 12,
  title: "Fix the login loop",
  status: "in_progress",
  priority: "high",
  projectKey: "VAL",
  projectName: "Valytica",
  assigneeName: "Priya",
  ...over,
});

const json = (x: unknown) => JSON.stringify(x);

describe("searchResultsCard", () => {
  it("lists each task with Assign to me and Open", () => {
    const card = searchResultsCard("login", [task()], APP);
    expect(json(card)).toContain("VAL-12 · Fix the login loop");
    expect(json(card)).toContain("In Progress · Priya");
    expect(json(card)).toContain(ACTION_ASSIGN_ME);
    expect(json(card)).toContain(`${APP}/issues/${task().id}`);
  });

  it("caps at eight and says when nothing matched", () => {
    const many = Array.from({ length: 12 }, (_, i) => task({ id: `id-${i}`, number: i + 1 }));
    expect(searchResultsCard("x", many, APP).children.filter((c) => c.type === "actions")).toHaveLength(8);
    expect(json(searchResultsCard("<!here>", [], APP))).toContain("No tasks match “&lt;!here&gt;”");
  });
});

describe("mine", () => {
  it("groups open tasks by status in board order", () => {
    const g = groupByStatus([task({ status: "todo" }), task({ status: "done" }), task({ status: "backlog" }), task({ status: "todo" })]);
    expect(g.map((x) => [x.status, x.rows.length])).toEqual([
      ["backlog", 1],
      ["todo", 2],
    ]);
  });

  it("says so when there's nothing open, and cuts long lists", () => {
    expect(json(mineCard([task({ status: "done" })], APP))).toContain("no open tasks");
    const many = Array.from({ length: 5 }, (_, i) => task({ id: `t${i}` }));
    expect(json(mineCard(many, APP, 3))).toContain("and 2 more");
  });
});

describe("taskCard", () => {
  const snap: RecordSnapshot = {
    type: "issue",
    id: "i1",
    workspaceId: "w",
    projectId: null,
    title: "VAL-12 · Fix",
    path: "/issues/i1",
    fields: [],
    status: "todo",
  };

  it("adds Comment beside the notification card's actions", () => {
    const card = taskCard(snap, "Created by Priya", APP);
    const actions = card.children.filter((c) => c.type === "actions");
    expect(actions).toHaveLength(1);
    const ids = json(actions[0]);
    expect(ids).toContain(ACTION_ASSIGN_ME);
    expect(ids).toContain(ACTION_COMMENT);
    expect(ids).toContain(ACTION_SET_STATUS);
  });

  it("writes a headline", () => {
    expect(taskHeadline("Priya", new Date("2026-11-03T12:00:00Z"))).toBe("Created by Priya · updated 03-11-2026");
    expect(taskHeadline(null, null)).toBe("Task");
  });
});

describe("the new-task modal's values", () => {
  it("requires a title", () => {
    expect(readNewTaskValues({ title: "  " })).toEqual({ ok: false, errors: { title: "Give the task a title." } });
  });

  it("reads 'none' as no project or assignee", () => {
    const r = readNewTaskValues({ title: " Fix  it ", project: "none", assignee: "u1", priority: "high", status: "todo", label: "l1", post: "yes" });
    expect(r).toEqual({
      ok: true,
      value: { title: "Fix it", description: "", projectId: null, assigneeId: "u1", priority: "high", status: "todo", labelIds: ["l1"], post: true },
    });
  });
});

const prospect: ProspectView = {
  kind: "valuer",
  id: "IBBI/RV/1",
  ref: "valuer:IBBI/RV/1",
  name: "Sharma & Co",
  status: "Demo done",
  city: "Pune",
  assigned: "Priya",
  nextStep: "Send pricing",
  nextStepDate: "2026-11-10",
  lastContacted: "2026-11-01",
  lastTouch: { date: "2026-11-01", channel: "Call", outcome: "Connected", by: "Priya", summary: "Keen on a pilot" },
};

describe("prospects", () => {
  it("shows stage, owner, next step and last touch", () => {
    expect(prospectFieldsOf(prospect)).toEqual([
      { label: "Stage", value: "Demo done" },
      { label: "Owner", value: "Priya" },
      { label: "Next step", value: "Send pricing · 10-11-2026" },
      { label: "Last touch", value: "01-11-2026 · Call · Connected · by Priya" },
    ]);
  });

  it("offers Log a touch, carrying what the modal needs", () => {
    const card = prospectsCard("sharma", [prospect], APP);
    expect(json(card)).toContain(ACTION_LOG_TOUCH);
    expect(json(card)).toContain(encodeURIComponent(prospect.ref));
    expect(decodeTouchButton(encodeTouchButton(prospect))).toEqual({
      ref: prospect.ref,
      name: prospect.name,
      status: prospect.status,
      nextStep: prospect.nextStep,
    });
    expect(decodeTouchButton("not json")).toBeNull();
  });

  it("validates a logged touch", () => {
    expect(readTouchValues({ outcome: "Made up" }).ok).toBe(false);
    expect(readTouchValues({ outcome: "Connected", next_step_date: "tomorrow" }).ok).toBe(false);
    expect(readTouchValues({ outcome: "Connected", channel: "Call", status: "Pilot running", next_step: " " })).toEqual({
      ok: true,
      value: {
        channel: "Call",
        direction: "Outbound",
        outcome: "Connected",
        summary: "",
        statusAfter: "Pilot running",
        nextStep: null,
        nextStepDate: null,
      },
    });
  });
});
