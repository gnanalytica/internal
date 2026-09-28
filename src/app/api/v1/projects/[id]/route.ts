import { recordRoute } from "@/lib/api/record-route";

const handlers = recordRoute("projects", ["DELETE"]);

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
