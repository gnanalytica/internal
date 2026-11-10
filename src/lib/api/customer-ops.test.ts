import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomerSuccessData } from "@/lib/customer-success-data";

import type { ApiAuth } from "./auth";
import { UNRESTRICTED, type ApiScope } from "./scope-rules";

/**
 * The phone's customer endpoints, through their route handlers: the web's
 * Sales gate then its Customers tab (visible project, Sales on, Sales rule,
 * Valytica with Customer Success on), and what a customer record carries.
 * Every member has Sales today, so the rule is turned off for members here to
 * prove a caller without it gets nothing and can change nothing.
 */

const h = vi.hoisted(() => ({
  auth: null as unknown,
  project: null as unknown,
  data: null as unknown,
  selects: [] as unknown[][],
  updated: [] as unknown[],
  load: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  invalidate: vi.fn(),
  slack: vi.fn(),
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
vi.mock("@/lib/customer-success-data", () => ({ loadCustomerSuccess: h.load }));
vi.mock("@/lib/data", () => ({ getMembers: async () => [] }));
vi.mock("@/lib/prospects/read", () => ({ loadWorkbook: async () => ({}), PROSPECTS_TAG: "prospects" }));
vi.mock("@/lib/prospects/deals", () => ({ syncProspectDeal: vi.fn() }));
vi.mock("@/lib/slack/notify", () => ({ emitSlackEvent: h.slack }));
vi.mock("@/db", () => {
  const chain = () => {
    const rows = h.selects.shift() ?? [];
    const done = Object.assign(Promise.resolve(rows), { limit: async () => rows });
    return { from: () => ({ where: () => done }) };
  };
  return {
    db: {
      select: chain,
      update: () => ({ set: (v: unknown) => ({ where: () => ({ returning: async () => (h.update(v), h.updated) }) }) }),
      insert: () => ({ values: (v: unknown) => ({ returning: async () => (h.insert(v), [{ id: "t-new" }]) }) }),
    },
  };
});

const one = () => import("@/app/api/v1/projects/[id]/customers/[kind]/[cid]/route");
const onboarding = () => import("@/app/api/v1/projects/[id]/customers/[kind]/[cid]/onboarding/route");
const requests = () => import("@/app/api/v1/projects/[id]/customers/[kind]/[cid]/requests/route");

const VAL = "6f1c2b9e-4d3a-4b8e-9a51-0c7d2e8f1a23";
const MEMBER: ApiScope = { restricted: true, hiddenProjectIds: new Set(["fin"]), ownedProjectIds: new Set() };
const as = (scope: ApiScope): ApiAuth => ({ workspaceId: "ws", userId: "u1", keyId: "k", isAdmin: !scope.restricted, kind: "app", scope });
const ctx = (id: string, kind: string, cid: string) => ({ params: Promise.resolve({ id, kind, cid }) });
const url = (id: string, kind: string, cid: string, rest = "") => `https://x/api/v1/projects/${id}/customers/${kind}/${encodeURIComponent(cid)}${rest}`;

async function getOne(kind = "valuer", cid = "IBBI/RV/1", id = VAL) {
  const { GET } = await one();
  const res = await GET(new Request(url(id, kind, cid)), ctx(id, kind, encodeURIComponent(cid)));
  return { status: res.status, body: await res.json() };
}
async function tick(body: unknown, id = VAL) {
  const { POST } = await onboarding();
  const res = await POST(new Request(url(id, "valuer", "IBBI/RV/1", "/onboarding"), { method: "POST", body: JSON.stringify(body) }), ctx(id, "valuer", encodeURIComponent("IBBI/RV/1")));
  return { status: res.status, body: await res.json() };
}
async function ask(body: unknown, id = VAL) {
  const { POST } = await requests();
  const res = await POST(new Request(url(id, "valuer", "IBBI/RV/1", "/requests"), { method: "POST", body: JSON.stringify(body) }), ctx(id, "valuer", encodeURIComponent("IBBI/RV/1")));
  return { status: res.status, body: await res.json() };
}

const TODAY = "2026-11-10";
const NOW = Date.parse("2026-11-10T06:00:00Z");

function data(): CustomerSuccessData {
  const ticket = (id: string, status: string, dealId: string | null, createdAt: string) =>
    ({ id, subject: `Request ${id}`, body: "Can we export to PDF?", status, priority: "normal", entity: "India", via: "whatsapp", dealId, createdAt: new Date(createdAt), updatedAt: new Date(createdAt), project: null, account: null, contact: null, assignee: null, issue: null }) as unknown as CustomerSuccessData["requests"][number];
  return {
    projectId: VAL,
    customers: [
      {
        ref: "valuer:IBBI/RV/1",
        kind: "valuer",
        id: "IBBI/RV/1",
        name: "Asha Rao",
        city: "Hyderabad",
        state: "Telangana",
        stage: 4,
        assigned: "",
        nextStep: "Check in on the first report",
        lastTouch: "2026-11-08",
        deal: { id: "d1", stage: "pilot", value: 50000, entity: "India", createdAt: "2026-10-01T00:00:00.000Z", owner: "Sandeep", onboarding: { kickoff: "2026-10-02" } },
        since: { date: "2026-10-01", activityId: null },
        touches: [],
        checkIns: 1,
      },
    ],
    requests: [ticket("t1", "solved", "d1", "2026-10-20T00:00:00Z"), ticket("t2", "open", "d1", "2026-11-09T12:00:00Z"), ticket("t3", "open", "d-other", "2026-11-01T00:00:00Z")],
    answers: [],
    dealNames: {},
    today: TODAY,
    now: NOW,
    warnings: [],
    sheetUrl: "https://sheet",
    feedback: { projectId: VAL, themes: [], sent: {} },
  } as CustomerSuccessData;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.selects = [];
  h.updated = [];
  h.project = { id: VAL, key: "VAL", name: "Valytica", ownerId: null, enabledDepartments: ["sales", "customer-success"], pricingModel: null, strategyModel: null };
  h.load.mockImplementation(async () => data());
});

describe("GET /projects/{id}/customers/{kind}/{cid}", () => {
  it("gives the customer's record as the web's Customers tab shows it", async () => {
    h.auth = as(UNRESTRICTED);
    const { status, body } = await getOne();
    expect(status).toBe(200);
    const c = body.data.customer;
    expect(c).toMatchObject({ ref: "valuer:IBBI/RV/1", name: "Asha Rao", where: "Registered valuer · Hyderabad", owner: "Sandeep", health: "fine", healthLabel: "Doing fine", lastTouchLabel: "2 days ago", openRequests: 1, checkIns: 1 });
    expect(c.plan).toMatch(/^Pilot · .*50,000 deal$/);
    // Only this customer's requests, waiting on us first.
    expect(c.requests.map((r: { id: string; state: string }) => [r.id, r.state])).toEqual([
      ["t2", "waiting-us"],
      ["t1", "answered"],
    ]);
    expect(c.requests[0]).toMatchObject({ via: "whatsapp", viaLabel: "WhatsApp", stateLabel: "Waiting on us", body: "Can we export to PDF?" });
    expect(c.onboarding).toMatchObject({ done: 1, total: 6, current: 2, checkInsNeeded: 4 });
    expect(c.onboarding.steps[0]).toMatchObject({ id: "kickoff", done: true, doneOn: "2026-10-02", auto: false });
    expect(c.deal).not.toHaveProperty("onboarding");
    expect(body.data.today).toBe(TODAY);
  });

  it("refuses a member without Sales, without reading the customers", async () => {
    h.auth = as(MEMBER);
    const { status, body } = await getOne();
    expect(status).toBe(403);
    expect(body.error).toMatch(/Sales/);
    expect(h.load).not.toHaveBeenCalled();
  });

  it("hides a project the member may not see, and answers 404 off Valytica or with Customer Success off", async () => {
    h.auth = as(MEMBER);
    expect((await getOne("valuer", "IBBI/RV/1", "fin")).status).toBe(404);

    h.auth = as(UNRESTRICTED);
    (h.project as { key: string }).key = "RLT";
    expect((await getOne()).status).toBe(404);

    (h.project as { key: string; enabledDepartments: string[] }).key = "VAL";
    (h.project as { enabledDepartments: string[] }).enabledDepartments = ["sales"];
    expect((await getOne()).status).toBe(404);

    (h.project as { enabledDepartments: string[] }).enabledDepartments = ["customer-success"];
    expect((await getOne()).status).toBe(404);
    expect(h.load).not.toHaveBeenCalled();
  });

  it("answers 404 for a prospect that isn't a customer, and for an unknown kind", async () => {
    h.auth = as(UNRESTRICTED);
    expect((await getOne("valuer", "IBBI/RV/9")).status).toBe(404);
    expect((await getOne("planet", "IBBI/RV/1")).status).toBe(404);
  });
});

describe("POST /projects/{id}/customers/{kind}/{cid}/onboarding", () => {
  it("ticks a step on the customer's deal and answers with the ticks as saved", async () => {
    h.auth = as(UNRESTRICTED);
    h.selects = [[{ id: "d1", onboarding: {} }]];
    h.updated = [{ onboarding: { kickoff: "2026-10-02", setup: TODAY } }];
    const { status, body } = await tick({ step: "setup", done: true });
    expect(status).toBe(200);
    expect(body.data.onboarding).toEqual({ kickoff: "2026-10-02", setup: TODAY });
    expect(h.update).toHaveBeenCalledTimes(1);
    expect(h.invalidate).toHaveBeenCalledWith("ws", "crm");
  });

  it("refuses a member without Sales before touching the deal", async () => {
    h.auth = as(MEMBER);
    const { status } = await tick({ step: "setup", done: true });
    expect(status).toBe(403);
    expect(h.update).not.toHaveBeenCalled();
  });

  it("refuses an unknown step and a missing done", async () => {
    h.auth = as(UNRESTRICTED);
    h.selects = [[{ id: "d1", onboarding: {} }]];
    expect((await tick({ step: "party", done: true })).status).toBe(400);
    expect((await tick({ step: "setup" })).status).toBe(400);
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe("POST /projects/{id}/customers/{kind}/{cid}/requests", () => {
  it("adds a request tied to the customer's deal, assigned to the caller", async () => {
    h.auth = as(UNRESTRICTED);
    h.selects = [[{ id: "d1", onboarding: {} }]];
    const { status, body } = await ask({ subject: "Export to PDF", body: "For the bank", via: "call" });
    expect(status).toBe(201);
    expect(body.data).toEqual({ id: "t-new" });
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ projectId: VAL, dealId: "d1", subject: "Export to PDF", body: "For the bank", via: "call", status: "open", assigneeId: "u1" }));
    expect(h.slack).toHaveBeenCalled();
    expect(h.invalidate).toHaveBeenCalledWith("ws", "tickets", "projects", "crm");
  });

  it("refuses a member without Sales, and a request with no subject", async () => {
    h.auth = as(MEMBER);
    expect((await ask({ subject: "Export" })).status).toBe(403);
    h.auth = as(UNRESTRICTED);
    expect((await ask({ subject: "  " })).status).toBe(400);
    expect(h.insert).not.toHaveBeenCalled();
  });
});
