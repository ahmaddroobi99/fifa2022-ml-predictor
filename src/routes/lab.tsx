import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { TeamSelect } from "@/components/team-select";
import { ProbabilityBar } from "@/components/probability-bar";
import { Button } from "@/components/ui/button";
import { Card, CardKicker, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { counterfactualFlip, predictMatch, stressTest, DEFAULT_SCENARIO } from "@/lib/ml/engine";
import type { Scenario } from "@/lib/ml/types";
import { pct } from "@/lib/utils";

export const Route = createFileRoute("/lab")({ component: LabPage });

function LabPage() {
  const [a, setA] = React.useState("Argentina");
  const [b, setB] = React.useState("France");
  const [s, setS] = React.useState<Scenario>({ ...DEFAULT_SCENARIO, nSims: 8000 });
  const bundle = React.useMemo(() => {
    try {
      return predictMatch(a, b, s);
    } catch {
      return null;
    }
  }, [a, b, s]);
  const stress = React.useMemo(() => (bundle ? stressTest(a, b) : []), [a, b, bundle]);
  const cf = React.useMemo(() => (bundle ? counterfactualFlip(a, b) : null), [a, b, bundle]);

  const set = (key: keyof Scenario, value: number | boolean) =>
    setS((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <PageHeader
        kicker="Simulation lab"
        title="Sample the match, then break it"
        lede="Expected goals are Poisson intensities fitted from each side's recent scoring and FIFA attack/defense scores. Sliders are multiplicative perturbations — they are scenarios, not facts."
      />

      <Card className="mb-6 grid gap-4 md:grid-cols-2">
        <TeamSelect label="Team A" value={a} onChange={setA} exclude={b} />
        <TeamSelect label="Team B" value={b} onChange={setB} exclude={a} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardKicker>Scenario controls</CardKicker>
          <CardTitle>What-if knobs</CardTitle>
          <div className="mt-4 space-y-4">
            {(
              [
                ["attackA", `${a} attack`],
                ["defenseA", `${a} defense`],
                ["formA", `${a} form`],
                ["attackB", `${b} attack`],
                ["defenseB", `${b} defense`],
                ["formB", `${b} form`],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-2 flex justify-between text-xs text-muted">
                  {label}
                  <span className="tabular">{Math.round(((s[key] as number) || 0) * 100)}%</span>
                </span>
                <Slider
                  min={-0.15}
                  max={0.15}
                  step={0.01}
                  value={[s[key] as number]}
                  onValueChange={([v]) => set(key, v)}
                />
              </label>
            ))}
            <label className="flex items-center justify-between gap-3 text-sm">
              Hypothetical home advantage for {a}
              <Switch checked={s.homeAdvantage} onCheckedChange={(v) => set("homeAdvantage", v)} />
            </label>
            <label className="block">
              <span className="mb-2 flex justify-between text-xs text-muted">
                Simulations
                <span className="tabular">{s.nSims.toLocaleString()}</span>
              </span>
              <Slider min={1000} max={12000} step={500} value={[s.nSims]} onValueChange={([v]) => set("nSims", v)} />
            </label>
            <Button variant="outline" onClick={() => setS({ ...DEFAULT_SCENARIO, nSims: 8000 })}>
              Reset scenario
            </Button>
          </div>
        </Card>

        {bundle ? (
          <div className="space-y-4">
            <Card>
              <CardKicker>Monte Carlo</CardKicker>
              <CardTitle>
                {bundle.sim.n.toLocaleString()} matches · λ {bundle.xg.lambdaA.toFixed(2)} / {bundle.xg.lambdaB.toFixed(2)}
              </CardTitle>
              <ProbabilityBar
                className="mt-4"
                a={bundle.sim.pWin}
                draw={bundle.sim.pDraw}
                b={bundle.sim.pLose}
                labelA={a}
                labelB={b}
              />
              <div className="mt-5">
                <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted">Score heatmap (0–5)</p>
                <div className="overflow-x-auto">
                  <table className="text-center text-[11px]">
                    <thead>
                      <tr>
                        <th className="p-1 text-muted" />
                        {bundle.sim.heatmap[0].map((_, j) => (
                          <th key={j} className="p-1 text-muted tabular">
                            {j}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bundle.sim.heatmap.map((row, i) => (
                        <tr key={i}>
                          <th className="p-1 text-muted tabular">{i}</th>
                          {row.map((p, j) => (
                            <td key={j} className="p-1">
                              <span
                                className="grid size-8 place-items-center rounded-[8px] tabular"
                                style={{
                                  background: `color-mix(in oklab, var(--color-accent) ${Math.min(90, p * 900)}%, var(--color-elevated))`,
                                }}
                              >
                                {p > 0.02 ? Math.round(p * 100) : ""}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
            <Card>
              <CardKicker>Most frequent scorelines</CardKicker>
              <ol className="space-y-2">
                {bundle.sim.scorelines.map((row) => (
                  <li key={row.score} className="flex justify-between text-sm">
                    <span>
                      {bundle.teamA.code} {row.score.replace("-", "–")} {bundle.teamB.code}
                    </span>
                    <span className="tabular text-muted">{pct(row.p)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        ) : (
          <Card>
            <CardTitle>We couldn't generate a prediction.</CardTitle>
            <p className="mt-2 text-sm text-muted">Please check the selected teams and try again.</p>
          </Card>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardKicker>Stress matrix</CardKicker>
          <CardTitle>Does the pick survive ±5%?</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="py-2 font-medium">Scenario</th>
                  <th className="font-medium">{a}</th>
                  <th className="font-medium">Draw</th>
                  <th className="font-medium">{b}</th>
                  <th className="font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {stress.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="py-2">{row.label}</td>
                    <td className="tabular">{pct(row.pWin)}</td>
                    <td className="tabular">{pct(row.pDraw)}</td>
                    <td className="tabular">{pct(row.pLose)}</td>
                    <td className="tabular text-muted">{(row.delta * 100).toFixed(1)} pp</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardKicker>Counterfactual</CardKicker>
          <CardTitle>What would flip the logistic?</CardTitle>
          {cf ? (
            <div className="mt-3 space-y-3 text-sm text-muted">
              <p>
                Baseline pick: <span className="text-fg">{cf.basePick}</span>
              </p>
              {cf.firstFlip ? (
                <p>
                  Smallest searched perturbation that changes the class: {b} attack{" "}
                  {Math.round(cf.firstFlip.attackB * 100)}%, midfield {Math.round(cf.firstFlip.midfieldB * 100)}%
                  → pick {cf.firstFlip.pick}. {cf.nFlips} of {cf.tried} grid cells flipped.
                </p>
              ) : (
                <p>No flip inside ±12% attack/midfield for {b}. The rank gap is doing most of the work.</p>
              )}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
