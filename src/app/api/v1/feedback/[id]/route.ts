import { recordRoute } from "@/lib/api/record-route";

const handlers = recordRoute("feedback");

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
