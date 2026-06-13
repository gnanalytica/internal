export type RelationType = "blocks" | "related" | "duplicate";
export type RelationDirection = "outgoing" | "incoming";

/** Relation types offered when adding a relation (the outgoing-direction label). */
export const RELATION_TYPES: { id: RelationType; label: string }[] = [
  { id: "blocks", label: "Blocking" },
  { id: "related", label: "Related" },
  { id: "duplicate", label: "Duplicate of" },
];

/** Human label for a relation as seen from the current issue. */
export function relationLabel(
  type: RelationType,
  direction: RelationDirection,
): string {
  switch (type) {
    case "blocks":
      return direction === "outgoing" ? "Blocking" : "Blocked by";
    case "duplicate":
      return direction === "outgoing" ? "Duplicate of" : "Duplicated by";
    default:
      return "Related";
  }
}

export function isRelationType(v: string): v is RelationType {
  return v === "blocks" || v === "related" || v === "duplicate";
}
