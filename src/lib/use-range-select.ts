"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How close to the scroller's edge (px) a drag has to get before it scrolls. */
const EDGE = 48;
/** Fastest auto-scroll, px per frame, reached right at the edge. */
const MAX_SPEED = 18;

type Drag = {
  anchor: string;
  /** Whether this drag ticks rows or unticks them — set by the first row. */
  adding: boolean;
  /** The selection as it stood when the drag began; the range is laid over it. */
  base: Set<string>;
  lastY: number;
};

/**
 * Selection for a list of rows, with the three ways people expect to pick
 * many at once:
 *
 * - click a checkbox to toggle one;
 * - shift-click to take everything between the last one and this one;
 * - press on a checkbox and drag up or down to sweep a range. Starting on an
 *   unticked row selects, starting on a ticked one unselects, like Gmail.
 *
 * `order` is the rows as they're drawn, top to bottom, so a range follows what
 * you see across groups. Rows are found under the pointer by `data-select-id`,
 * which keeps it working for touch (no pointerenter there) and needs no
 * handlers per row. `scrollRef` is the scroller to nudge when a drag nears its
 * top or bottom edge.
 */
export function useRangeSelect(order: string[], scrollRef: React.RefObject<HTMLElement | null>) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dragging, setDragging] = useState(false);
  const anchorRef = useRef<string | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const orderRef = useRef(order);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const rangeBetween = useCallback((a: string, b: string) => {
    const ids = orderRef.current;
    const i = ids.indexOf(a);
    const j = ids.indexOf(b);
    if (i < 0 || j < 0) return [b];
    return ids.slice(Math.min(i, j), Math.max(i, j) + 1);
  }, []);

  const applyRange = useCallback(
    (to: string) => {
      const d = dragRef.current;
      if (!d) return;
      const next = new Set(d.base);
      for (const id of rangeBetween(d.anchor, to)) {
        if (d.adding) next.add(id);
        else next.delete(id);
      }
      setSelected(next);
    },
    [rangeBetween],
  );

  /** Keyboard and plain toggles: one row, and it becomes the shift anchor. */
  const toggle = useCallback((id: string) => {
    anchorRef.current = id;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Pointer down on a row's checkbox: shift-range, or the start of a drag. */
  const pointerDown = useCallback(
    (id: string, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // We decide what the press does; the native toggle would fight it.
      e.preventDefault();
      const adding = !selected.has(id);

      if (e.shiftKey && anchorRef.current && anchorRef.current !== id) {
        const next = new Set(selected);
        for (const r of rangeBetween(anchorRef.current, id)) {
          if (adding) next.add(r);
          else next.delete(r);
        }
        setSelected(next);
        anchorRef.current = id;
        return;
      }

      anchorRef.current = id;
      dragRef.current = { anchor: id, adding, base: new Set(selected), lastY: e.clientY };
      // Touch would otherwise scroll the page instead of sweeping rows.
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      setDragging(true);
      applyRange(id);
    },
    [selected, rangeBetween, applyRange],
  );

  // While a drag is live: follow the pointer, scroll near the edges, end on up.
  useEffect(() => {
    if (!dragging) return;
    const body = document.body;
    const prevSelect = body.style.userSelect;
    body.style.userSelect = "none";
    let frame = 0;

    const rowAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-select-id]");
      return el?.dataset.selectId ?? null;
    };

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      d.lastY = e.clientY;
      const id = rowAt(e.clientX, e.clientY);
      if (id) applyRange(id);
    };

    // Scroll while the pointer sits near an edge, faster the closer it gets,
    // and keep extending the range under it as rows slide by.
    const tick = () => {
      const d = dragRef.current;
      const el = scrollRef.current;
      if (d && el) {
        const r = el.getBoundingClientRect();
        let dy = 0;
        if (d.lastY < r.top + EDGE) dy = -Math.ceil(((r.top + EDGE - d.lastY) / EDGE) * MAX_SPEED);
        else if (d.lastY > r.bottom - EDGE)
          dy = Math.ceil(((d.lastY - (r.bottom - EDGE)) / EDGE) * MAX_SPEED);
        if (dy) {
          el.scrollTop += dy;
          const y = Math.min(Math.max(d.lastY, r.top + 1), r.bottom - 1);
          const id = rowAt(r.left + Math.min(r.width / 2, 80), y);
          if (id) applyRange(id);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const end = () => {
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      cancelAnimationFrame(frame);
      body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  }, [dragging, applyRange, scrollRef]);

  const clear = useCallback(() => {
    anchorRef.current = null;
    setSelected(new Set());
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(orderRef.current)), []);

  return { selected, setSelected, toggle, pointerDown, clear, selectAll, dragging };
}
