import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProbabilityBar } from "@/components/probability-bar";
import { TeamCrest } from "@/components/team-crest";
import { ORIGINAL, DATASET, WEIGHTS, getTeam, predictMatch } from "@/lib/ml/engine";
import { pct } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const arg = getTeam("Argentina")!;
  const fra = getTeam("France")!;
  const live = predictMatch("Argentina", "France");
  const notebookFinal = ORIGINAL.actualPairsWithOriginalProba.find((m) => m.round === "Final");
  const groupAcc = ORIGINAL.groupStageAccuracy;
  const xgb = WEIGHTS.notebookOriginal.groupStageHoldout.accuracy;

  const metrics = [
    { label: "International matches", value: DATASET.stats.internationalMatches.rows.toLocaleString() },
    { label: "Training rows", value: DATASET.stats.training.rows.toLocaleString() },
    { label: "FIFA 22 players", value: DATASET.stats.players22.rows.toLocaleString() },
    { label: "WC squads", value: "32" },
    { label: "XGB holdout (notebook)", value: pct(xgb, 0) },
    { label: "Group-stage scored", value: `${groupAcc.correct}/${groupAcc.n}` },
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] bg-surface shadow-[var(--shadow-border)]">
        <div className="pitch-grid px-5 py-8 sm:px-10 sm:py-12">
          <Badge tone="accent">Qatar 2022 · reconstructed</Badge>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
            FIFA 2022
            <span className="block text-accent">ML match lab</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-muted">
            A 2022 BSc classifier rebuilt as an interactive football intelligence platform: Team DNA,
            matchup differentials, Monte Carlo scorelines, and an honest leakage audit.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/predict">
                Explore predictions <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/methodology">View methodology</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardKicker>Hero matchup · actual final</CardKicker>
          <div className="mb-6 flex items-center justify-between gap-3">
            <TeamCrest team={arg} />
            <span className="font-display text-sm tracking-[0.2em] text-muted">VS</span>
            <TeamCrest team={fra} />
          </div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted">Original 2022 XGBoost (notebook)</p>
          <ProbabilityBar
            a={notebookFinal?.pA ?? 0.27}
            draw={notebookFinal?.pDraw ?? 0.23}
            b={notebookFinal?.pB ?? 0.5}
            labelA="Argentina"
            labelB="France"
          />
          <p className="mt-4 text-sm text-muted">
            The student model favoured France ({pct(notebookFinal?.pB ?? 0.5)}). Actual result: Argentina
            3–3 France, Argentina on penalties. Reconstruction engine below is the five-feature logistic,
            not a claim that XGBoost has been re-run.
          </p>
          <div className="mt-5 rounded-[18px] bg-elevated p-4">
            <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">Live reconstruction (logistic + simulation)</p>
            <ProbabilityBar
              a={live.original.win}
              draw={live.original.draw}
              b={live.original.lose}
              labelA="Argentina"
              labelB="France"
            />
          </div>
        </Card>
        <Card>
          <CardKicker>Provenance</CardKicker>
          <CardTitle>Student project, not a product</CardTitle>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li>An-Najah National University, BSc Computer Engineering, 2022.</li>
            <li>Data dump ends 14 Jun 2022 — five months before kickoff.</li>
            <li>Not current research. Not a betting service.</li>
            <li>Original notebooks are preserved, unmodified.</li>
          </ul>
          <Button variant="outline" className="mt-6 w-full" asChild>
            <Link to="/about">Project provenance</Link>
          </Button>
        </Card>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-[20px] bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="font-display text-3xl tabular">{m.value}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">{m.label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            to: "/lab" as const,
            kicker: "Innovation",
            title: "Monte Carlo lab",
            body: "Sample thousands of Poisson scorelines, then perturb attack, defense, and form.",
          },
          {
            to: "/tournament" as const,
            kicker: "Knockout",
            title: "Actual vs implied bracket",
            body: "Score the 2022 notebook against the tournament that actually happened — including misses.",
          },
          {
            to: "/model" as const,
            kicker: "Maturity",
            title: "Leakage audit",
            body: "One-hot team names, random splits, and mean-fill across time are documented, not hidden.",
          },
        ].map((c) => (
          <Card key={c.to} className="flex flex-col">
            <CardKicker>{c.kicker}</CardKicker>
            <CardTitle>{c.title}</CardTitle>
            <p className="mt-2 flex-1 text-sm text-muted">{c.body}</p>
            <Button variant="ghost" className="mt-4 justify-start px-0" asChild>
              <Link to={c.to}>
                Open <ArrowRight className="size-4" />
              </Link>
            </Button>
          </Card>
        ))}
      </section>
    </div>
  );
}
