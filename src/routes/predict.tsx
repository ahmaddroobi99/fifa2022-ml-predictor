import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TeamSelect } from "@/components/team-select";
import { TeamCrest } from "@/components/team-crest";
import { ProbabilityBar } from "@/components/probability-bar";
import { Button } from "@/components/ui/button";
import { Card, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { predictMatch, type PredictionBundle } from "@/lib/ml/engine";
import { fmt, pct } from "@/lib/utils";

export const Route = createFileRoute("/predict")({ component: PredictPage });

function PredictPage() {
  const [a, setA] = React.useState("Argentina");
  const [b, setB] = React.useState("France");
  const [bundle, setBundle] = React.useState<PredictionBundle | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const run = React.useCallback(() => {
    setError(null);
    setLoading(true);
    window.setTimeout(() => {
      try {
        setBundle(predictMatch(a, b));
      } catch (e) {
        setBundle(null);
        setError(e instanceof Error ? e.message : "We couldn't generate a prediction.");
      } finally {
        setLoading(false);
      }
    }, 180);
  }, [a, b]);

  React.useEffect(() => {
    run();
  }, [run]);

  return (
    <div>
      <PageHeader
        kicker="Match predictor"
        title="Pick a knockout-era matchup"
        lede="The reconstruction uses the same five FIFA rank and squad-score differentials as the 2022 notebooks. Simulation and Team DNA sit beside it — not instead of it."
      />

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
          <TeamSelect label="Team A" value={a} onChange={setA} exclude={b} />
          <Button
            variant="outline"
            size="icon"
            className="mx-auto"
            aria-label="Swap teams"
            onClick={() => {
              setA(b);
              setB(a);
            }}
          >
            <ArrowLeftRight className="size-4" />
          </Button>
          <TeamSelect label="Team B" value={b} onChange={setB} exclude={a} />
        </div>
        <Button className="mt-4 w-full md:w-auto" onClick={run}>
          Predict match
        </Button>
      </Card>

      {error ? (
        <Card>
          <CardTitle>We couldn't generate a prediction.</CardTitle>
          <p className="mt-2 text-sm text-muted">{error} Check the selected teams and try again.</p>
        </Card>
      ) : null}

      {loading && !bundle ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : null}

      {bundle ? <Result bundle={bundle} /> : null}
    </div>
  );
}

function Result({ bundle }: { bundle: PredictionBundle }) {
  const { teamA, teamB, original, sim, council, matchup, drivers, summary, notebook } = bundle;
  const fav = original.win >= original.lose ? teamA.name : teamB.name;
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <TeamCrest team={teamA} size="lg" />
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Model favours</p>
            <p className="font-display text-3xl">{fav}</p>
            <Badge tone="muted" className="mt-2">
              Confidence is a class probability, not a guarantee
            </Badge>
          </div>
          <TeamCrest team={teamB} size="lg" />
        </div>
        <ProbabilityBar
          className="mt-6"
          a={original.win}
          draw={original.draw}
          b={original.lose}
          labelA={teamA.name}
          labelB={teamB.name}
        />
      </Card>

      {notebook?.pA != null ? (
        <Card>
          <CardKicker>Original notebook</CardKicker>
          <CardTitle>What the 2022 XGBoost printed</CardTitle>
          <ProbabilityBar
            className="mt-4"
            a={notebook.pA}
            draw={notebook.pDraw ?? 0}
            b={notebook.pB ?? 0}
            labelA={teamA.name}
            labelB={teamB.name}
          />
          <p className="mt-3 text-sm text-muted">
            Predicted {notebook.predicted ?? "—"}.
            {notebook.actual ? ` Actual: ${notebook.actual}${notebook.score ? ` (${notebook.score})` : ""}.` : ""}
            {notebook.round ? ` Source round: ${notebook.round}.` : ""}
          </p>
        </Card>
      ) : (
        <Card>
          <CardKicker>Original notebook</CardKicker>
          <p className="text-sm text-muted">
            This exact pair was not printed in Final_Prediction.ipynb. The reconstruction engine still
            scores it from the five numeric features.
          </p>
        </Card>
      )}

      <Card>
        <CardKicker>Why this matchup</CardKicker>
        <CardTitle>Feature comparison</CardTitle>
        <p className="mt-2 text-sm text-muted">{summary}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="py-2 font-medium">Dimension</th>
                <th className="font-medium">{teamA.code}</th>
                <th className="font-medium">{teamB.code}</th>
                <th className="font-medium">Edge</th>
              </tr>
            </thead>
            <tbody>
              {matchup.map((row) => (
                <tr key={row.dim} className="border-t border-line">
                  <td className="py-2 text-muted">{row.dim}</td>
                  <td className="tabular">{fmt(row.a, row.a > 20 ? 0 : 2)}</td>
                  <td className="tabular">{fmt(row.b, row.b > 20 ? 0 : 2)}</td>
                  <td>
                    {row.advantage === "even" ? (
                      <span className="text-subtle">Even</span>
                    ) : (
                      <span>{row.advantage === "A" ? teamA.code : teamB.code}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardKicker>Model council</CardKicker>
          <CardTitle>Do the layers agree?</CardTitle>
          <ul className="mt-4 space-y-3">
            {council.map((m) => (
              <li key={m.name} className="flex items-start justify-between gap-3 rounded-[16px] bg-elevated px-3 py-3">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted">{m.note}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg">{m.pick}</p>
                  <p className="text-xs tabular text-muted">{pct(m.pWin)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardKicker>Drivers</CardKicker>
          <CardTitle>Signed feature contributions</CardTitle>
          <p className="mt-2 text-sm text-muted">
            Magnitude is |standardized feature × mean |weight|| on the enhanced model. Direction: positive
            favours {teamA.name}.
          </p>
          <ul className="mt-4 space-y-2">
            {drivers.slice(0, 8).map((d) => (
              <li key={d.feature}>
                <div className="flex justify-between text-xs text-muted">
                  <span>{d.feature.replaceAll("_", " ")}</span>
                  <span className="tabular">{d.signed.toFixed(3)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className={d.signed >= 0 ? "h-full bg-accent" : "h-full bg-fg/50"}
                    style={{ width: `${Math.min(100, Math.abs(d.signed) * 80 + 8)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardKicker>Simulation overlay</CardKicker>
        <CardTitle>
          {sim.n.toLocaleString()} sampled matches · avg {fmt(sim.meanA, 2)}–{fmt(sim.meanB, 2)}
        </CardTitle>
        <ProbabilityBar className="mt-4" a={sim.pWin} draw={sim.pDraw} b={sim.pLose} labelA={teamA.name} labelB={teamB.name} />
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {sim.scorelines.map((s) => (
            <li key={s.score} className="flex justify-between rounded-[14px] bg-elevated px-3 py-2 text-sm">
              <span>
                {teamA.code} {s.score.replace("-", "–")} {teamB.code}
              </span>
              <span className="tabular text-muted">{pct(s.p)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
