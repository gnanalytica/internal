// Pure migration planner — NO database access. Given the current org rows,
// returns the set of changes to reach the redesigned structure (see
// docs/superpowers/specs/2026-06-25-org-structure-redesign-design.md).

export type ReorgInput = {
  teams: { id: string; name: string }[];
  projects: {
    id: string;
    name: string;
    kind?: "project" | "operation";
    ownerTeamId?: string | null;
  }[];
  databases: { id: string; name: string }[];
};

type PodName = "Products" | "Platform";

// Which projects belong to which pod (by current project name).
const PRODUCTS_POD = new Set(["Healthytica", "Valytica", "AI Workshop", "Standup-AI"]);
const PLATFORM_POD = new Set(["Internal"]);
const OPS_PROJECTS = new Set(["Hiring", "NL Payroll Setup", "India Payroll Setup"]);
const DELETE_PROJECTS = new Set(["Compliance — India", "Compliance — Netherlands"]);
const KEEP_DATABASES = new Set(["People", "Tools & Subscriptions"]);
const RENAMES: Record<string, string> = { "NL Payroll Setup": "India Payroll Setup" };

// Old team name -> pod it folds into, for remapping issues.
const TEAM_TO_POD: Record<string, PodName> = {
  Healthytica: "Products",
  Valytica: "Products",
  "AI Workshop": "Products",
  "Internal Tools": "Platform",
};

const POD_NAMES: PodName[] = ["Products", "Platform"];

export type ReorgPlan = {
  pods: { name: PodName }[];
  projectUpdates: { id: string; name: string; kind: "project" | "operation"; ownerPod: PodName | null }[];
  projectRenames: { id: string; from: string; to: string }[];
  deleteProjectIds: string[];
  deleteTeamIds: string[];
  deleteDatabaseIds: string[];
  mergeVendorsIntoToolsId: { from: string; to: string } | null;
  teamToPod: Record<string, PodName>;
  isNoop: boolean;
};

function podForProject(name: string): PodName | null {
  if (PRODUCTS_POD.has(name)) return "Products";
  if (PLATFORM_POD.has(name)) return "Platform";
  return null;
}

export function planReorg(input: ReorgInput): ReorgPlan {
  const existingPodNames = new Set(input.teams.map((t) => t.name));
  const pods = POD_NAMES.filter((n) => !existingPodNames.has(n)).map((name) => ({ name }));

  const projectUpdates: ReorgPlan["projectUpdates"] = [];
  const projectRenames: ReorgPlan["projectRenames"] = [];
  const deleteProjectIds: string[] = [];

  for (const proj of input.projects) {
    if (DELETE_PROJECTS.has(proj.name)) {
      deleteProjectIds.push(proj.id);
      continue;
    }
    const finalName = RENAMES[proj.name] ?? proj.name;
    if (finalName !== proj.name) {
      projectRenames.push({ id: proj.id, from: proj.name, to: finalName });
    }
    const kind: "project" | "operation" = OPS_PROJECTS.has(proj.name) ? "operation" : "project";
    const ownerPod = kind === "operation" ? null : podForProject(finalName);
    projectUpdates.push({ id: proj.id, name: finalName, kind, ownerPod });
  }

  // Teams to delete = every current team that isn't one of the two pods.
  const deleteTeamIds = input.teams
    .filter((t) => !POD_NAMES.includes(t.name as PodName))
    .map((t) => t.id);

  // Databases: drop everything except People + Tools & Subscriptions; Vendors is
  // merged into Tools & Subscriptions first, then deleted.
  const deleteDatabaseIds = input.databases
    .filter((d) => !KEEP_DATABASES.has(d.name) && d.name !== "Vendors")
    .map((d) => d.id);
  const vendors = input.databases.find((d) => d.name === "Vendors");
  const tools = input.databases.find((d) => d.name === "Tools & Subscriptions");
  const mergeVendorsIntoToolsId =
    vendors && tools ? { from: vendors.id, to: tools.id } : null;
  if (vendors) deleteDatabaseIds.push(vendors.id);

  // teamToPod: old team ID -> pod name, for remapping issues off mirror teams.
  const teamToPod: Record<string, PodName> = {};
  for (const t of input.teams) {
    const pod = TEAM_TO_POD[t.name];
    if (pod) teamToPod[t.id] = pod;
  }

  const isNoop =
    pods.length === 0 &&
    projectRenames.length === 0 &&
    deleteProjectIds.length === 0 &&
    deleteTeamIds.length === 0 &&
    deleteDatabaseIds.length === 0;

  return {
    pods,
    projectUpdates,
    projectRenames,
    deleteProjectIds,
    deleteTeamIds,
    deleteDatabaseIds,
    mergeVendorsIntoToolsId,
    teamToPod,
    isNoop,
  };
}
