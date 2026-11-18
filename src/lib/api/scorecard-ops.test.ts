import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiAuth } from "./auth";
import { UNRESTRICTED, type ApiScope } from "./scope-rules";

/**
 * The phone's scorecard endpoints, through their route handlers: who may read
 * and write, and that Sales rows follow the Sales rule. Every member has Sales
 * today, so the rule is turned off for members here to prove a caller without
 * it gets no Sales rows and can't type into one.
 */

const h = vi.hoisted(() => ({
  auth: null as unknown,
  project: null as unknown,
  metrics: [] as unknown[],
  selects: [] as unknown[][],
  findFirst: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
  invalidate: vi.fn(),
  snapshot: vi.fn(),
  getMetrics: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), updateTag: vi.fn(), refresh: vi.fn() }));
vi.mock("./auth", () => ({ authenticateApiKey: async () => h.auth }));
vi.mock("./invalidate", () => ({ apiInvalidate: h.invalidate }));
vi.mock("./business-ops", () => ({
  loadProjectMeta: async () => h.project,
  departmentOn: (p: { enabledDepartments: string[] }, slug: string) => p.enabledDepartments.includes(slug),
}));
vi.mock("@/lib/departments", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/departments")>();
  return { ...real, canSeeDepartment: (slug: string, role: string, isOwner?: boolean) => (slug === "sales" ? role === "admin" : real.canSeeDepartment(slug, role, isOwner)) };
});
vi.mock("@/lib/data", () => ({
  getMetrics: h.getMetrics,
  getScorecardSignals: async () => ({ dealsWon: [], published: [], defects: null }),
}));
vi.mock("@/lib/prospects/read", () => ({ loadProspectSnapshot: h.snapshot }));
vi.mock("@/db", () => {
  // select(...).from(...).where(...) is awaited as is, or with .limit(n).
  const chain = () => {
    const rows = h.selects.shift() ?? [];
    const done = Object.assign(Promise.resolve(rows), { limit: async () => rows });
    return { from: () => ({ where: () => done }) };
  };
  return {
    db: {
      select: chain,
      query: { metrics: { findFirst: h.findFirst } },
      insert: () => ({ values: async (v: unknown) => h.insert(v) }),
      update: () => ({ set: (v: unknown) => ({ where: async () => h.update(v) }) }),
      delete: () => ({ where: async () => h.del() }),
    },
  };
});

const route = () => import("@/app/api/v1/projects/[id]/scorecard/route");

const MEMBER: ApiScope = { restricted: true, hiddenProjectIds: new Set(["fin"]), ownedProjectIds: new Set() };
const as = (scope: ApiScope): ApiAuth => ({ workspaceId: "ws", userId: "u1", keyId: "k", isAdmin: !scope.restricted, kind: "app", scope });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const metric = (id: string, area: string, source: string, target: number | null = null) => ({ id, name: id, unit: null, area, source, target, targetDirection: "above", points: [] });

async function get(id = "val") {
  const { GET } = await route();
  const res = await GET(new Request(`https://x/api/v1/projects/${id}/scorecard`), ctx(id));
  return { status: res.status, body: await res.json() };
}

async function post(body: unknown, id = "val") {
  const { POST } = await route();
  const res = await POST(new Request(`https://x/api/v1/projects/${id}/scorecard`, { method: "POST", body: JSON.stringify(body) }), ctx(id));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.selects = [];
  h.project = { id: "val", key: "VAL", name: "Valytica", ownerId: null, enabledDepartments: ["analytics", "sales"], pricingModel: null, strategyModel: null };
  h.metrics = [metric("touches", "sales", "sales.touches", 60), metric("whatsapp", "marketing", "manual", 50), metric("uptime", "reliability", "manual", 99.5), metric("quoted", "sales", "manual", 3)];
  h.getMetrics.mockImplementation(async () => h.metrics);
  h.snapshot.mockResolvedValue({ activity: [], rows: { valuer: [], firm: [], rvo: [], panel: [], bank: [] } });
});

describe("GET /projects/{id}/scorecard", () => {
  it("gives an admin every row, grouped by area, with what the web works out", async () => {
    h.auth = as(UNRESTRICTED);
    const { status, body } = await get();
    expect(status).toBe(200);
    const d = body.data;
    expect(d.enabled).toBe(true);
    expect(d.weeks).toHaveLength(5);
    expect(d.thisWeek).toBe(d.weeks[4]);
    expect(d.areas.map((a: { id: string }) => a.id)).toEqual(["sales", "marketing", "reliability"]);
    expect(d.rows.map((r: { id: string }) => r.id)).toEqual(["touches", "quoted", "whatsapp", "uptime"]);
    const touches = d.rows[0];
    expect(touches).toMatchObject({ editable: false, targetLabel: "60", status: "empty", now: null });
    expect(touches.how).toMatch(/Touches logged/);
    expect(d.rows[2]).toMatchObject({ editable: true, how: null });
    expect(d.summary).toEqual({ on: 0, behind: 0, waiting: 4, total: 4 });
    expect(h.snapshot).toHaveBeenCalled();
  });

  it("gives a member without Sales no Sales rows, and doesn't read the prospects sheet for them", async () => {
    h.auth = as(MEMBER);
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.data.rows.map((r: { id: string }) => r.id)).toEqual(["whatsapp", "uptime"]);
    expect(body.data.rows.some((r: { area: string }) => r.area === "sales")).toBe(false);
    expect(body.data.areas.map((a: { id: string }) => a.id)).toEqual(["marketing", "reliability"]);
    expect(body.data.summary.total).toBe(2);
    expect(h.snapshot).not.toHaveBeenCalled();
  });

  it("hides a project the member may not see", async () => {
    h.auth = as(MEMBER);
    const { status } = await get("fin");
    expect(status).toBe(404);
    expect(h.getMetrics).not.toHaveBeenCalled();
  });

  it("says so, without reading anything, when Analytics is off", async () => {
    h.auth = as(UNRESTRICTED);
    (h.project as { enabledDepartments: string[] }).enabledDepartments = ["sales"];
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ enabled: false, rows: [], weeks: [] });
    expect(h.getMetrics).not.toHaveBeenCalled();
  });
});

describe("POST /projects/{id}/scorecard", () => {
  // Any Monday is a valid week; without one the handler uses this week's.
  const thisMonday = () => "2026-11-09";

  it("types this week's number into a typed-in row, through the web's write", async () => {
    h.auth = as(MEMBER);
    h.selects = [[{ id: "uptime", projectId: "val", area: "reliability" }], []];
    h.findFirst.mockResolvedValue({ id: "uptime", source: "manual" });
    const { status, body } = await post({ metricId: "uptime", weekStart: thisMonday(), value: 99.9 });
    expect(status).toBe(200);
    expect(body.data).toEqual({ metricId: "uptime", weekStart: "2026-11-09", value: 99.9 });
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ metricId: "uptime", value: 99.9 }));
    expect(h.invalidate).toHaveBeenCalledWith("ws", "metrics", "projects");
  });

  it("refuses a member without Sales a Sales row, before writing anything", async () => {
    h.auth = as(MEMBER);
    h.selects = [[{ id: "quoted", projectId: "val", area: "sales" }]];
    const { status, body } = await post({ metricId: "quoted", value: 2 });
    expect(status).toBe(403);
    expect(body.error).toMatch(/Sales/);
    expect(h.findFirst).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("lets an admin type into a Sales row", async () => {
    h.auth = as(UNRESTRICTED);
    h.selects = [[{ id: "quoted", projectId: "val", area: "sales" }], [{ id: "p1" }]];
    h.findFirst.mockResolvedValue({ id: "quoted", source: "manual" });
    const { status } = await post({ metricId: "quoted", weekStart: thisMonday(), value: 2 });
    expect(status).toBe(200);
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ value: 2 }));
  });

  it("only writes a metric on this project", async () => {
    h.auth = as(UNRESTRICTED);
    h.selects = [[{ id: "other", projectId: "elsewhere", area: "product" }]];
    const { status } = await post({ metricId: "other", value: 1 });
    expect(status).toBe(404);
    expect(h.findFirst).not.toHaveBeenCalled();
  });

  it("hides a project the member may not see", async () => {
    h.auth = as(MEMBER);
    const { status } = await post({ metricId: "x", value: 1 }, "fin");
    expect(status).toBe(404);
  });

  it("refuses a counted row, a weekday and a non-number", async () => {
    h.auth = as(UNRESTRICTED);
    h.selects = [[{ id: "touches", projectId: "val", area: "marketing" }]];
    h.findFirst.mockResolvedValue({ id: "touches", source: "marketing.posted" });
    expect((await post({ metricId: "touches", weekStart: thisMonday(), value: 3 })).status).toBe(422);

    h.selects = [[{ id: "uptime", projectId: "val", area: "reliability" }]];
    expect((await post({ metricId: "uptime", weekStart: "2026-11-10", value: 3 })).status).toBe(400);

    expect((await post({ metricId: "uptime", value: "lots" })).status).toBe(400);
    expect((await post({ value: 1 })).status).toBe(400);
    expect(h.insert).not.toHaveBeenCalled();
  });
});
