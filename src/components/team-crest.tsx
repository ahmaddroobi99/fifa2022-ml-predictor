import { cn } from "@/lib/utils";
import type { Team } from "@/lib/ml/types";

export function TeamCrest({
  team,
  size = "md",
  showName = true,
}: {
  team: Team;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}) {
  const dim = size === "lg" ? "size-12 text-sm" : size === "sm" ? "size-8 text-[10px]" : "size-10 text-xs";
  return (
    <span className="inline-flex items-center gap-2.5 min-w-0">
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full font-display font-semibold tracking-wide",
          dim,
        )}
        style={{ background: team.colors.primary, color: team.colors.secondary }}
        aria-hidden
      >
        {team.code.slice(0, 3)}
      </span>
      {showName ? (
        <span className="min-w-0">
          <span className="block truncate font-medium text-fg">{team.name}</span>
          <span className="block text-[11px] uppercase tracking-[0.14em] text-muted">
            Group {team.group} · #{team.fifaRank}
          </span>
        </span>
      ) : null}
    </span>
  );
}
