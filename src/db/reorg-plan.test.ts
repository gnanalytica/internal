import { describe, expect, it } from "vitest";

import { planReorg, type ReorgInput } from "./reorg-plan";

// Mirrors the CURRENT seeded state (pre-reorg).
const CURRENT: ReorgInput = {
  teams: [
    { id: "t-hlt", name: "Healthytica" },
    { id: "t-vlt", name: "Valytica" },
    { id: "t-wrk", name: "AI Workshop" },
    { id: "t-itl", name: "Internal Tools" },
    { id: "t-adm", name: "Admin" },
    { id: "t-hr", name: "People (HR)" },
    { id: "t-fin", name: "Finance" },
    { id: "t-sal", name: "Sales" },
    { id: "t-mkt", name: "Marketing" },
  ],
  projects: [
    { id: "p-hlt", name: "Healthytica" },
    { id: "p-vlt", name: "Valytica" },
    { id: "p-aiw", name: "AI Workshop" },
    { id: "p-int", name: "Internal" },
    { id: "p-std", name: "Standup-AI" },
    { id: "p-cin", name: "Compliance — India" },
    { id: "p-cnl", name: "Compliance — Netherlands" },
    { id: "p-hire", name: "Hiring" },
    { id: "p-pay", name: "NL Payroll Setup" },
  ],
  databases: [
    { id: "d-ppl", name: "People" },
    { id: "d-ven", name: "Vendors" },
    { id: "d-con", name: "Contracts" },
    { id: "d-ast", name: "Assets" },
    { id: "d-tls", name: "Tools & Subscriptions" },
  ],
};

describe("planReorg", () => {
  const plan = planReorg(CURRENT);

  it("creates the two pods", () => {
    expect(plan.pods.map((p) => p.name)).toEqual(["Products", "Platform"]);
  });

  it("assigns each kept product a kind and owning pod", () => {
    const byProject = Object.fromEntries(plan.projectUpdates.map((u) => [u.name, u]));
    expect(byProject["Healthytica"]).toMatchObject({ kind: "project", ownerPod: "Products" });
    expect(byProject["Standup-AI"]).toMatchObject({ kind: "project", ownerPod: "Products" });
    expect(byProject["Internal"]).toMatchObject({ kind: "project", ownerPod: "Platform" });
    expect(byProject["Hiring"]).toMatchObject({ kind: "operation", ownerPod: null });
  });

  it("renames NL Payroll Setup to India Payroll Setup", () => {
    const rename = plan.projectRenames.find((r) => r.from === "NL Payroll Setup");
    expect(rename?.to).toBe("India Payroll Setup");
  });

  it("deletes the compliance projects", () => {
    expect(plan.deleteProjectIds).toEqual(expect.arrayContaining(["p-cin", "p-cnl"]));
  });

  it("deletes the 9 redundant teams, keeps none of them", () => {
    expect(plan.deleteTeamIds.sort()).toEqual(
      ["t-hlt", "t-vlt", "t-wrk", "t-itl", "t-adm", "t-hr", "t-fin", "t-sal", "t-mkt"].sort(),
    );
  });

  it("drops Vendors, Contracts, Assets databases; keeps People + Tools", () => {
    expect(plan.deleteDatabaseIds.sort()).toEqual(["d-ast", "d-con", "d-ven"].sort());
    expect(plan.mergeVendorsIntoToolsId).toEqual({ from: "d-ven", to: "d-tls" });
  });

  it("maps old product-mirror teams to their pod for issue remapping", () => {
    expect(plan.teamToPod["t-hlt"]).toBe("Products");
    expect(plan.teamToPod["t-itl"]).toBe("Platform");
  });

  it("is idempotent: planning the post-reorg state is a no-op", () => {
    const POST: ReorgInput = {
      teams: [
        { id: "t-prod", name: "Products" },
        { id: "t-plat", name: "Platform" },
      ],
      projects: [
        { id: "p-hlt", name: "Healthytica", kind: "project", ownerTeamId: "t-prod" },
        { id: "p-int", name: "Internal", kind: "project", ownerTeamId: "t-plat" },
        { id: "p-hire", name: "Hiring", kind: "operation", ownerTeamId: null },
        { id: "p-pay", name: "India Payroll Setup", kind: "operation", ownerTeamId: null },
      ],
      databases: [
        { id: "d-ppl", name: "People" },
        { id: "d-tls", name: "Tools & Subscriptions" },
      ],
    };
    const p2 = planReorg(POST);
    expect(p2.deleteTeamIds).toEqual([]);
    expect(p2.deleteProjectIds).toEqual([]);
    expect(p2.deleteDatabaseIds).toEqual([]);
    expect(p2.projectRenames).toEqual([]);
    expect(p2.isNoop).toBe(true);
  });
});
