import * as React from "react";
import { TEAMS, getTeam } from "@/lib/ml/engine";
import { Input } from "@/components/ui/input";
import { TeamCrest } from "@/components/team-crest";
import { cn } from "@/lib/utils";

export function TeamSelect({
  label,
  value,
  onChange,
  exclude,
}: {
  label: string;
  value: string;
  onChange: (name: string) => void;
  exclude?: string;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const selected = getTeam(value);
  const list = TEAMS.filter(
    (t) =>
      t.name !== exclude &&
      (t.name.toLowerCase().includes(q.toLowerCase()) ||
        t.code.toLowerCase().includes(q.toLowerCase()) ||
        t.group.toLowerCase() === q.toLowerCase()),
  );
  return (
    <div className="relative">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{label}</p>
      <button
        type="button"
        className="flex h-16 w-full items-center justify-between rounded-[18px] bg-elevated px-3 text-left shadow-[var(--shadow-border)]"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? <TeamCrest team={selected} /> : <span className="text-muted">Select team</span>}
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-full rounded-[20px] bg-surface p-2 shadow-[var(--shadow-border-hover)]">
          <Input
            autoFocus
            placeholder="Search team, code, group…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={`Search ${label}`}
          />
          <ul role="listbox" className="mt-2 max-h-64 overflow-auto">
            {list.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted">No teams match that search.</li>
            ) : (
              list.map((t) => (
                <li key={t.name}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full rounded-[14px] px-2 py-2 text-left hover:bg-elevated",
                      t.name === value && "bg-elevated",
                    )}
                    onClick={() => {
                      onChange(t.name);
                      setOpen(false);
                      setQ("");
                    }}
                  >
                    <TeamCrest team={t} size="sm" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
