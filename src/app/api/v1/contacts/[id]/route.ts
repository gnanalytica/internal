import { recordRoute } from "@/lib/api/record-route";

const handlers = recordRoute("contacts");

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
