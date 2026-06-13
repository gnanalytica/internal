"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowUpDown,
  Check,
  Columns3,
  MoreHorizontal,
  Plus,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
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
import {
  FIELD_TYPES,
  type DatabaseField,
  type DatabaseRow,
  type DatabaseWithSchema,
  type SelectOption,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "table" | "board";

export function DatabaseView({
  database,
  isAdmin,
}: {
  database: DatabaseWithSchema;
  isAdmin: boolean;
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
          <TableView database={database} rows={rows} persist={persist} />
        ) : (
          <BoardView database={database} rows={rows} field={firstSelect!} persist={persist} />
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
}: {
  database: DatabaseWithSchema;
  rows: DatabaseRow[];
  persist: (fn: () => Promise<unknown>) => void;
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
              <AddFieldButton databaseId={database.id} persist={persist} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group/r border-b last:border-0 hover:bg-accent/30">
              {database.fields.map((f) => (
                <td key={f.id} className="border-r p-0">
                  <Cell field={f} row={row} databaseId={database.id} persist={persist} />
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
  databaseId,
  persist,
}: {
  field: DatabaseField;
  row: DatabaseRow;
  databaseId: string;
  persist: (fn: () => Promise<unknown>) => void;
}) {
  const values = (row.values as Record<string, unknown>) ?? {};
  const raw = values[field.id];
  const commit = (v: unknown) => persist(() => updateCell(row.id, databaseId, field.id, v));

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

function AddFieldButton({
  databaseId,
  persist,
}: {
  databaseId: string;
  persist: (fn: () => Promise<unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("text");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" className="size-6" />}
        aria-label="Add field"
      >
        <Plus className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-2 p-3">
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
        <Button
          size="sm"
          className="h-7 w-full"
          disabled={!name.trim()}
          onClick={() => {
            persist(() => addField(databaseId, { name, type }));
            setName("");
            setType("text");
            setOpen(false);
          }}
        >
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
