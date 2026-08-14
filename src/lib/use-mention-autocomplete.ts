"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { mentionKeysForMember } from "@/lib/mentions";

type MentionMember = { id: string; name: string; email: string };

/** How many suggestions a dropdown shows before it stops being scannable. */
const LIMIT = 5;

/**
 * @-mention autocomplete for a plain textarea.
 *
 * Shared by the task and page comment composers, which had grown the same
 * logic twice — and both times without keyboard selection, so the dropdown
 * could only be clicked. Typing a name and pressing Enter, which is what
 * everyone actually does, inserted a newline instead.
 */
export function useMentionAutocomplete<M extends MentionMember>({
  members,
  value,
  onChange,
}: {
  members: M[];
  value: string;
  onChange: (next: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** The partial @token being typed, or null when not mentioning. */
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(
    () =>
      query === null
        ? []
        : members
            .filter((m) =>
              query === ""
                ? true
                : mentionKeysForMember(m).some((k) => k.startsWith(query)),
            )
            .slice(0, LIMIT),
    [members, query],
  );

  const open = suggestions.length > 0;
  // A stale index from a previous, longer list would insert the wrong person.
  const safeIndex = Math.min(activeIndex, Math.max(0, suggestions.length - 1));

  const close = useCallback(() => {
    setQuery(null);
    setActiveIndex(0);
  }, []);

  /** Track the @token under the caret as the user types. */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      onChange(next);
      const caret = e.target.selectionStart ?? next.length;
      // Only a token at a word boundary counts, so an email address doesn't
      // open the dropdown halfway through.
      const match = next.slice(0, caret).match(/(?:^|\s)@([\w.-]*)$/);
      setQuery(match ? match[1].toLowerCase() : null);
      setActiveIndex(0);
    },
    [onChange],
  );

  const insert = useCallback(
    (member: M) => {
      const ta = textareaRef.current;
      const caret = ta?.selectionStart ?? value.length;
      const before = value
        .slice(0, caret)
        .replace(/@([\w.-]*)$/, `@${mentionKeysForMember(member)[0]} `);
      onChange(before + value.slice(caret));
      close();
      // Put the caret after the inserted mention, not back at the start.
      requestAnimationFrame(() => {
        ta?.focus();
        ta?.setSelectionRange(before.length, before.length);
      });
    },
    [value, onChange, close],
  );

  /**
   * Key handling for the dropdown. Returns true when the key was consumed, so
   * the caller can skip its own handling (submit, escape-to-close, …).
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!open) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return true;
      }
      // Enter picks the highlighted person. A modifier means "send", which is
      // the composer's business, so let that through untouched.
      if ((e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) || e.key === "Tab") {
        e.preventDefault();
        insert(suggestions[safeIndex]);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return true;
      }
      return false;
    },
    [open, suggestions, safeIndex, insert, close],
  );

  return {
    textareaRef,
    suggestions,
    open,
    activeIndex: safeIndex,
    setActiveIndex,
    handleChange,
    handleKeyDown,
    insert,
    close,
  };
}
