import { cn, pct } from "@/lib/utils";

export function ProbabilityBar({
  a,
  draw,
  b,
  labelA,
  labelB,
  className,
}: {
  a: number;
  draw: number;
  b: number;
  labelA: string;
  labelB: string;
  className?: string;
}) {
  const s = a + draw + b || 1;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-end justify-between gap-3 font-display">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{labelA}</p>
          <p className="text-3xl tabular leading-none">{pct(a / s, 1)}</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Draw</p>
          <p className="text-xl tabular text-muted">{pct(draw / s, 1)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{labelB}</p>
          <p className="text-3xl tabular leading-none">{pct(b / s, 1)}</p>
        </div>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-elevated" role="img" aria-label={`${labelA} ${pct(a / s)}, draw ${pct(draw / s)}, ${labelB} ${pct(b / s)}`}>
        <span className="bg-accent" style={{ width: `${(a / s) * 100}%` }} />
        <span className="bg-even" style={{ width: `${(draw / s) * 100}%` }} />
        <span className="bg-fg/80" style={{ width: `${(b / s) * 100}%` }} />
      </div>
    </div>
  );
}
