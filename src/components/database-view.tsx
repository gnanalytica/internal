"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  addField,
  addRow,
  deleteDatabase,
  deleteField,
  deleteRow,
  updateCell,
  updateDatabase,
} from "@/lib/actions";
import { filterRows, sortRows, type SortDir } from "@/lib/database-filters";
import { computeRollup, relationCellIds, rowLabel } from "@/lib/database-rollup";
import { WEEKDAYS, monthMatrix } from "@/lib/calendar";
import {
  FIELD_TYPES,
  type DatabaseField,
  type DatabaseRow,
  type DatabaseWithSchema,
  type RollupConfig,
  type RollupFn,
  type SelectOption,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "table" | "board" | "gallery" | "calendar";

export function DatabaseView({
  database,
  isAdmin,
  allDatabases,
}: {
  database: DatabaseWithSchema;
  isAdmin: boolean;
  allDatabases: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState(database.name);
  const [view, setView] = useState<View>("table");
  const [query, setQuery] = useState("");
  const [sortFieldId, setSortFieldId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const refresh = () => router.refresh();
  const persist = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      refresh();
    });

  const firstSelect = database.fields.find((f) => f.type === "select");
  const firstDate = database.fields.find((f) => f.type === "date");
  const sortField = database.fields.find((f) => f.id === sortFieldId) ?? null;

  const rows = useMemo(
    () => sortRows(filterRows(database.rows, query), sortField, sortDir),
    [database.rows, query, sortField, sortDir],
  );

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Databases", href: "/databases" }, { label: name }]}
        actions={
          <>
            <div className="flex items-center rounded-md border p-0.5">
              <ViewBtn active={view === "table"} onClick={() => setView("table")}>
                <Table2 className="size-3.5" /> Table
              </ViewBtn>
              <ViewBtn
                active={view === "board"}
                onClick={() => setView("board")}
                disabled={!firstSelect}
              >
                <Columns3 className="size-3.5" /> Board
              </ViewBtn>
              <ViewBtn active={view === "gallery"} onClick={() => setView("gallery")}>
                <LayoutGrid className="size-3.5" /> Gallery
              </ViewBtn>
              <ViewBtn
                active={view === "calendar"}
                onClick={() => setView("calendar")}
                disabled={!firstDate}
              >
                <CalendarDays className="size-3.5" /> Calendar
              </ViewBtn>
            </div>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" className="size-7" />}
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      persist(async () => {
                        await deleteDatabase(database.id);
                        toast.success("Database deleted");
                        router.push("/databases");
                      })
                    }
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" /> Delete database
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <div className="flex items-center gap-2 px-6 py-3">
        <span className="text-2xl leading-none">{database.icon}</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            void updateDatabase(database.id, { name: e.target.value.trim() || "Untitled" });
          }}
          className="bg-transparent text-xl font-bold outline-none"
        />
      </div>

      {/* Filter + sort toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 pb-2">
        <div className="flex h-7 items-center gap-1.5 rounded-md border px-2">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter rows…"
            className="w-40 bg-transparent text-xs outline-none"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" />}
          >
            <ArrowUpDown className="size-3.5" />
            {sortField ? `Sort: ${sortField.name}` : "Sort"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => setSortFieldId(null)}
              className="gap-2 text-xs text-muted-foreground"
            >
              <span className="flex-1">None (manual)</span>
              {sortFieldId === null && <Check className="size-3.5 opacity-70" />}
            </DropdownMenuItem>
            {database.fields.map((f) => (
              <DropdownMenuItem
                key={f.id}
                onClick={() => setSortFieldId(f.id)}
                className="gap-2 text-xs"
              >
                <span className="flex-1 truncate">{f.name}</span>
                {sortFieldId === f.id && <Check className="size-3.5 opacity-70" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {sortField && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {sortDir === "asc" ? "Ascending" : "Descending"}
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </span>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto px-6 pb-8">
        {view === "table" ? (
          <TableView
            database={database}
            rows={rows}
            persist={persist}
            allDatabases={allDatabases}
          />
        ) : view === "board" ? (
          <BoardView database={database} rows={rows} field={firstSelect!} persist={persist} />
        ) : view === "gallery" ? (
          <GalleryView database={database} rows={rows} />
        ) : (
          <CalendarView database={database} rows={rows} field={firstDate!} />
        )}
      </div>
    </div>
  );
}

function ViewBtn({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors disabled:opacity-40",
        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TableView({
  database,
  rows,
  persist,
  allDatabases,
}: {
  database: DatabaseWithSchema;
  rows: DatabaseRow[];
  persist: (fn: () => Promise<unknown>) => void;
  allDatabases: { id: string; name: string }[];
}) {
  return (
    <div className="inline-block min-w-full overflow-hidden rounded-lg border">
      <table className="text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {database.fields.map((f) => (
              <th
                key={f.id}
                className="group/h min-w-[10rem] border-r px-3 py-2 text-left font-medium"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {FIELD_TYPES.find((t) => t.id === f.type)?.icon}
                  </span>
                  <span className="truncate">{f.name}</span>
                  <button
                    onClick={() => persist(() => deleteField(f.id, database.id))}
                    className="ml-auto text-muted-foreground opacity-0 hover:text-destructive group-hover/h:opacity-100"
                    aria-label="Delete field"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </th>
            ))}
            <th className="px-2 py-2">
              <AddFieldButton
                database={database}
                persist={persist}
                allDatabases={allDatabases}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group/r border-b last:border-0 hover:bg-accent/30">
              {database.fields.map((f) => (
                <td key={f.id} className="border-r p-0">
                  <Cell field={f} row={row} database={database} persist={persist} />
                </td>
              ))}
              <td className="px-2 text-center">
                <button
                  onClick={() => persist(() => deleteRow(row.id, database.id))}
                  className="text-muted-foreground opacity-0 hover:text-destructive group-hover/r:opacity-100"
                  aria-label="Delete row"
                >
                  <Trash2 className="size-3" />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={database.fields.length + 1} className="px-3 py-1.5">
              <button
                onClick={() => persist(() => addRow(database.id))}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3.5" /> New row
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Cell({
  field,
  row,
  database,
  persist,
}: {
  field: DatabaseField;
  row: DatabaseRow;
  database: DatabaseWithSchema;
  persist: (fn: () => Promise<unknown>) => void;
}) {
  const databaseId = database.id;
  const values = (row.values as Record<string, unknown>) ?? {};
  const raw = values[field.id];
  const commit = (v: unknown) => persist(() => updateCell(row.id, databaseId, field.id, v));

  if (field.type === "relation") {
    return <RelationCell field={field} row={row} database={database} commit={commit} />;
  }

  if (field.type === "rollup") {
    const config = field.config as RollupConfig | null;
    const value = config
      ? computeRollup(config, row, database.fields, database.related)
      : "—";
    return (
      <div className="px-3 py-1.5 text-sm tabular-nums text-muted-foreground">{value}</div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center justify-center px-3 py-1.5">
        <input
          type="checkbox"
          checked={Boolean(raw)}
          onChange={(e) => commit(e.target.checked)}
          className="size-4 accent-[var(--brand)]"
        />
      </div>
    );
  }

  if (field.type === "url" || field.type === "email") {
    const str = raw == null ? "" : String(raw);
    const href = field.type === "email" ? `mailto:${str}` : str;
    return (
      <div className="flex items-center gap-1 px-1">
        <input
          type={field.type === "email" ? "email" : "url"}
          defaultValue={str}
          onBlur={(e) => {
            if (e.target.value !== str) commit(e.target.value);
          }}
          placeholder={field.type === "email" ? "name@example.com" : "https://…"}
          className="w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-brand/5"
        />
        {str && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-1 text-muted-foreground hover:text-brand"
            aria-label="Open"
          >
            ↗
          </a>
        )}
      </div>
    );
  }

  if (field.type === "multiSelect") {
    const options = (field.options as SelectOption[] | null) ?? [];
    const selected = Array.isArray(raw) ? (raw as string[]) : [];
    const toggle = (label: string) =>
      commit(
        selected.includes(label)
          ? selected.filter((s) => s !== label)
          : [...selected, label],
      );
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex min-h-[2rem] w-full flex-wrap items-center gap-1 px-3 py-1.5 text-left text-xs hover:bg-accent/40">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            selected.map((label) => {
              const o = options.find((x) => x.label === label);
              return (
                <span
                  key={label}
                  className="rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                  style={{
                    color: o?.color ?? "#64748b",
                    backgroundColor: `color-mix(in oklch, ${o?.color ?? "#64748b"} 14%, transparent)`,
                  }}
                >
                  {label}
                </span>
              );
            })
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {options.map((o) => (
            <DropdownMenuItem
              key={o.label}
              onClick={() => toggle(o.label)}
              className="gap-2 text-xs"
              closeOnClick={false}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: o.color }} />
              <span className="flex-1">{o.label}</span>
              {selected.includes(o.label) && <Check className="size-3.5 opacity-70" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (field.type === "select") {
    const options = (field.options as SelectOption[] | null) ?? [];
    const current = options.find((o) => o.label === raw);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-accent/40">
          {current ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                color: current.color,
                backgroundColor: `color-mix(in oklch, ${current.color} 14%, transparent)`,
              }}
            >
              {current.label}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={() => commit(null)} className="text-xs text-muted-foreground">
            Clear
          </DropdownMenuItem>
          {options.map((o) => (
            <DropdownMenuItem key={o.label} onClick={() => commit(o.label)} className="gap-2 text-xs">
              <span className="size-2 rounded-full" style={{ backgroundColor: o.color }} />
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      defaultValue={raw == null ? "" : String(raw)}
      onBlur={(e) => {
        const v =
          field.type === "number"
            ? e.target.value === ""
              ? null
              : Number(e.target.value)
            : e.target.value;
        if (v !== raw) commit(v);
      }}
      className="w-full bg-transparent px-3 py-1.5 text-sm outline-none focus:bg-brand/5"
    />
  );
}

function RelationCell({
  field,
  row,
  database,
  commit,
}: {
  field: DatabaseField;
  row: DatabaseRow;
  database: DatabaseWithSchema;
  commit: (v: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const target = field.relationDatabaseId
    ? database.related[field.relationDatabaseId]
    : null;
  const selected = relationCellIds(row, field.id);

  if (!target) {
    return <div className="px-3 py-1.5 text-xs text-muted-foreground">No target</div>;
  }

  const selectedRows = target.rows.filter((r) => selected.includes(r.id));

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    commit(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex min-h-[2rem] w-full flex-wrap items-center gap-1 px-3 py-1.5 text-left text-xs hover:bg-accent/40">
        {selectedRows.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          selectedRows.map((r) => (
            <span
              key={r.id}
              className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] text-brand"
            >
              {rowLabel(r, target.primaryFieldId)}
            </span>
          ))
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          <CommandInput placeholder={`Link ${target.name}…`} className="h-9" />
          <CommandList>
            <CommandEmpty>No rows.</CommandEmpty>
            <CommandGroup>
              {target.rows.map((r) => {
                const label = rowLabel(r, target.primaryFieldId);
                const isSel = selected.includes(r.id);
                return (
                  <CommandItem
                    key={r.id}
                    value={`${label} ${r.id}`}
                    onSelect={() => toggle(r.id)}
                    className="gap-2"
                  >
                    <span className="flex-1 truncate">{label}</span>
                    {isSel && <Check className="size-3.5 opacity-70" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const ROLLUP_FNS: { id: RollupFn; label: string }[] = [
  { id: "count", label: "Count" },
  { id: "sum", label: "Sum" },
  { id: "avg", label: "Average" },
  { id: "min", label: "Min" },
  { id: "max", label: "Max" },
];

function AddFieldButton({
  database,
  persist,
  allDatabases,
}: {
  database: DatabaseWithSchema;
  persist: (fn: () => Promise<unknown>) => void;
  allDatabases: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("text");
  // relation config
  const [relationDbId, setRelationDbId] = useState<string>("");
  // rollup config
  const [rollupRelId, setRollupRelId] = useState<string>("");
  const [rollupFn, setRollupFn] = useState<RollupFn>("count");
  const [rollupTargetField, setRollupTargetField] = useState<string>("");

  const relationFields = database.fields.filter(
    (f) => f.type === "relation" && f.relationDatabaseId,
  );
  const chosenRel = relationFields.find((f) => f.id === rollupRelId);
  const rollupTargetFields = chosenRel?.relationDatabaseId
    ? (database.related[chosenRel.relationDatabaseId]?.fields ?? [])
    : [];

  function reset() {
    setName("");
    setType("text");
    setRelationDbId("");
    setRollupRelId("");
    setRollupFn("count");
    setRollupTargetField("");
    setOpen(false);
  }

  const canAdd =
    name.trim() !== "" &&
    (type !== "relation" || relationDbId !== "") &&
    (type !== "rollup" ||
      (rollupRelId !== "" && (rollupFn === "count" || rollupTargetField !== "")));

  function add() {
    const input: {
      name: string;
      type: string;
      relationDatabaseId?: string | null;
      config?: RollupConfig;
    } = { name, type };
    if (type === "relation") input.relationDatabaseId = relationDbId;
    if (type === "rollup") {
      input.config = {
        relationFieldId: rollupRelId,
        targetFieldId: rollupFn === "count" ? null : rollupTargetField,
        fn: rollupFn,
      };
    }
    persist(() => addField(database.id, input));
    reset();
  }

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : reset())}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" className="size-6" />}
        aria-label="Add field"
      >
        <Plus className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2 p-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Field name"
          className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-brand"
        />
        <div className="flex flex-wrap gap-1">
          {FIELD_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs",
                type === t.id ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {type === "relation" && (
          <select
            value={relationDbId}
            onChange={(e) => setRelationDbId(e.target.value)}
            className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-brand"
          >
            <option value="">Link to database…</option>
            {allDatabases.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}

        {type === "rollup" && (
          <div className="space-y-1.5">
            {relationFields.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Add a relation field first to roll up its values.
              </p>
            ) : (
              <>
                <select
                  value={rollupRelId}
                  onChange={(e) => setRollupRelId(e.target.value)}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-brand"
                >
                  <option value="">Through relation…</option>
                  {relationFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <select
                  value={rollupFn}
                  onChange={(e) => setRollupFn(e.target.value as RollupFn)}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-brand"
                >
                  {ROLLUP_FNS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {rollupFn !== "count" && (
                  <select
                    value={rollupTargetField}
                    onChange={(e) => setRollupTargetField(e.target.value)}
                    className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-brand"
                  >
                    <option value="">Of field…</option>
                    {rollupTargetFields
                      .filter((f) => f.type === "number")
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </select>
                )}
              </>
            )}
          </div>
        )}

        <Button size="sm" className="h-7 w-full" disabled={!canAdd} onClick={add}>
          Add field
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function BoardView({
  database,
  rows,
  field,
  persist,
}: {
  database: DatabaseWithSchema;
  rows: DatabaseRow[];
  field: DatabaseField;
  persist: (fn: () => Promise<unknown>) => void;
}) {
  const options = (field.options as SelectOption[] | null) ?? [];
  const nameField = database.fields.find((f) => f.type === "text") ?? database.fields[0];
  const columns = [{ label: "No " + field.name, color: "#94a3b8", value: null as string | null }].concat(
    options.map((o) => ({ label: o.label, color: o.color, value: o.label as string | null })),
  );

  return (
    <div className="flex gap-3 pb-4">
      {columns.map((col) => {
        const colRows = rows.filter(
          (r) => ((r.values as Record<string, unknown>)[field.id] ?? null) === col.value,
        );
        return (
          <div key={col.label} className="flex w-64 shrink-0 flex-col">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: col.color }} />
              <span className="text-sm font-medium">{col.label}</span>
              <span className="text-xs text-muted-foreground">{colRows.length}</span>
            </div>
            <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-2">
              {colRows.map((r) => {
                const title = nameField
                  ? String((r.values as Record<string, unknown>)[nameField.id] ?? "Untitled")
                  : "Untitled";
                return (
                  <div key={r.id} className="rounded-lg border bg-background p-2.5 text-sm shadow-sm">
                    {title}
                  </div>
                );
              })}
              <button
                onClick={() => persist(() => addRow(database.id))}
                className="px-1 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
              >
                + New
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function cellText(row: DatabaseRow, field: DatabaseField): string {
  const v = (row.values as Record<string, unknown>)?.[field.id];
  if (v == null || v === "") return "";
  if (field.type === "checkbox") return v ? "✓" : "";
  if (Array.isArray(v)) return `${v.length}`;
  return String(v);
}

function GalleryView({
  database,
  rows,
}: {
  database: DatabaseWithSchema;
  rows: DatabaseRow[];
}) {
  const titleField =
    database.fields.find((f) => f.type === "text") ?? database.fields[0];
  const detailFields = database.fields.filter((f) => f.id !== titleField?.id).slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((row) => {
        const title = titleField ? cellText(row, titleField) : "";
        return (
          <div
            key={row.id}
            className="rounded-xl border bg-background p-3 shadow-sm transition-colors hover:border-foreground/20"
          >
            <div className="mb-2 truncate text-sm font-medium">{title || "Untitled"}</div>
            <div className="space-y-1">
              {detailFields.map((f) => {
                const text = cellText(row, f);
                if (!text) return null;
                return (
                  <div key={f.id} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 truncate text-muted-foreground">{f.name}</span>
                    <span className="truncate">{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({
  database,
  rows,
  field,
}: {
  database: DatabaseWithSchema;
  rows: DatabaseRow[];
  field: DatabaseField;
}) {
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const titleField =
    database.fields.find((f) => f.type === "text" && f.id !== field.id) ??
    database.fields.find((f) => f.id !== field.id) ??
    field;

  const weeks = monthMatrix(view.year, view.month);

  // Bucket rows by their date value (yyyy-mm-dd prefix).
  const byDay = new Map<string, DatabaseRow[]>();
  for (const r of rows) {
    const raw = (r.values as Record<string, unknown>)?.[field.id];
    if (typeof raw !== "string" || raw === "") continue;
    const key = raw.slice(0, 10);
    const arr = byDay.get(key) ?? [];
    arr.push(r);
    byDay.set(key, arr);
  }

  const monthName = new Date(Date.UTC(view.year, view.month, 1)).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  function shift(delta: number) {
    setView((v) => {
      const d = new Date(Date.UTC(v.year, v.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => shift(-1)}
          className="grid size-7 place-items-center rounded-md border hover:bg-accent"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">{monthName}</span>
        <button
          onClick={() => shift(1)}
          className="grid size-7 place-items-center rounded-md border hover:bg-accent"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
        <span className="ml-2 text-xs text-muted-foreground">by {field.name}</span>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((cell) => {
            const items = byDay.get(cell.key) ?? [];
            return (
              <div
                key={cell.key}
                className={cn(
                  "min-h-24 border-b border-r p-1.5 last:border-r-0",
                  !cell.inMonth && "bg-muted/20 text-muted-foreground",
                )}
              >
                <div className="mb-1 text-[11px]">{cell.day}</div>
                <div className="space-y-1">
                  {items.slice(0, 4).map((r) => (
                    <div
                      key={r.id}
                      className="truncate rounded bg-brand/10 px-1.5 py-0.5 text-[11px] text-brand"
                      title={cellText(r, titleField)}
                    >
                      {cellText(r, titleField) || "Untitled"}
                    </div>
                  ))}
                  {items.length > 4 && (
                    <div className="px-1 text-[10px] text-muted-foreground">
                      +{items.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
