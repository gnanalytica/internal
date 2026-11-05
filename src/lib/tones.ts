/**
 * The app's status colours. Each tone has a dot, a soft chip, plain text and a
 * bar fill, written out in full so Tailwind sees every class, and each holds
 * up in both themes: chips are a tint of the hue, never a solid block.
 *
 * Use a tone for what a thing *is* (a stage, a band, a channel) and keep the
 * brand colour for what you can *do* (buttons, focus, the current tab).
 */
export type Tone = "gray" | "blue" | "violet" | "indigo" | "teal" | "green" | "amber" | "orange" | "red" | "pink";

type ToneClasses = { dot: string; chip: string; text: string; bar: string; ring: string; edgeL: string; edgeT: string };

export const TONES: Record<Tone, ToneClasses> = {
  gray: { dot: "bg-zinc-400 dark:bg-zinc-500", chip: "bg-zinc-500/10 text-zinc-700 dark:bg-zinc-400/15 dark:text-zinc-300", text: "text-zinc-600 dark:text-zinc-400", bar: "bg-zinc-400 dark:bg-zinc-500", ring: "border-zinc-400/40", edgeL: "border-l-zinc-300 dark:border-l-zinc-600", edgeT: "border-t-zinc-300 dark:border-t-zinc-600" },
  blue: { dot: "bg-sky-500", chip: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300", text: "text-sky-700 dark:text-sky-400", bar: "bg-sky-500", ring: "border-sky-500/40", edgeL: "border-l-sky-500", edgeT: "border-t-sky-500" },
  violet: { dot: "bg-violet-500", chip: "bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300", text: "text-violet-700 dark:text-violet-400", bar: "bg-violet-500", ring: "border-violet-500/40", edgeL: "border-l-violet-500", edgeT: "border-t-violet-500" },
  indigo: { dot: "bg-indigo-500", chip: "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300", text: "text-indigo-700 dark:text-indigo-400", bar: "bg-indigo-500", ring: "border-indigo-500/40", edgeL: "border-l-indigo-500", edgeT: "border-t-indigo-500" },
  teal: { dot: "bg-teal-500", chip: "bg-teal-500/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300", text: "text-teal-700 dark:text-teal-400", bar: "bg-teal-500", ring: "border-teal-500/40", edgeL: "border-l-teal-500", edgeT: "border-t-teal-500" },
  green: { dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300", text: "text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500", ring: "border-emerald-500/40", edgeL: "border-l-emerald-500", edgeT: "border-t-emerald-500" },
  amber: { dot: "bg-amber-500", chip: "bg-amber-500/12 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300", text: "text-amber-700 dark:text-amber-400", bar: "bg-amber-500", ring: "border-amber-500/40", edgeL: "border-l-amber-500", edgeT: "border-t-amber-500" },
  orange: { dot: "bg-orange-500", chip: "bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300", text: "text-orange-700 dark:text-orange-400", bar: "bg-orange-500", ring: "border-orange-500/40", edgeL: "border-l-orange-500", edgeT: "border-t-orange-500" },
  red: { dot: "bg-red-500", chip: "bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300", text: "text-red-700 dark:text-red-400", bar: "bg-red-500", ring: "border-red-500/40", edgeL: "border-l-red-500", edgeT: "border-t-red-500" },
  pink: { dot: "bg-pink-500", chip: "bg-pink-500/10 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300", text: "text-pink-700 dark:text-pink-400", bar: "bg-pink-500", ring: "border-pink-500/40", edgeL: "border-l-pink-500", edgeT: "border-t-pink-500" },
};

export const tone = (t: Tone): ToneClasses => TONES[t];
