/** Reading a metric against its target. Pure — no imports, no I/O. */

export type TargetDirection = "above" | "below";

export type TargetRead = {
  /** True when the latest value satisfies the target. */
  onTrack: boolean;
  /** 0–100, how far the latest value has come towards the target. */
  progress: number;
  /** Signed distance still to cover; 0 once the target is met. */
  gap: number;
};

/**
 * Compare a metric's latest value with its target.
 *
 * `above` targets are floors — 90% accuracy, 5 leads — and progress is the
 * fraction of the target reached. `below` targets are ceilings — 0 defects,
 * ₹40 per report — where being under is success and progress is measured from
 * a starting point of twice the target, so "half way down" reads as 50%.
 * Returns null when there is nothing to compare.
 */
export function readTarget(
  latest: number | null | undefined,
  target: number | null | undefined,
  direction: TargetDirection = "above",
): TargetRead | null {
  if (latest == null || target == null || !Number.isFinite(latest) || !Number.isFinite(target))
    return null;

  if (direction === "below") {
    const onTrack = latest <= target;
    const gap = onTrack ? 0 : latest - target;
    // A zero target has no proportional scale — it is met or it is not.
    if (target === 0) return { onTrack, progress: onTrack ? 100 : 0, gap };
    const span = target * 2;
    const progress = clamp(((span - latest) / (span - target)) * 100);
    return { onTrack, progress, gap };
  }

  const onTrack = latest >= target;
  const gap = onTrack ? 0 : target - latest;
  if (target === 0) return { onTrack, progress: onTrack ? 100 : 0, gap };
  return { onTrack, progress: clamp((latest / target) * 100), gap };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Formats a target for display: "≥ 90%" / "≤ 30 sec". */
export function formatTarget(
  target: number | null | undefined,
  direction: TargetDirection = "above",
  unit?: string | null,
): string | null {
  if (target == null) return null;
  const op = direction === "below" ? "≤" : "≥";
  const n = target.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (!unit) return `${op} ${n}`;
  return unit === "%" || unit.startsWith("/") ? `${op} ${n}${unit}` : `${op} ${n} ${unit}`;
}
