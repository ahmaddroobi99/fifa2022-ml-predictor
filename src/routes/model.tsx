import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { Card, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EXPERIMENTS, WEIGHTS } from "@/lib/ml/engine";
import { pct } from "@/lib/utils";

export const Route = createFileRoute("/model")({ component: ModelPage });

function ModelPage() {
  const nb = WEIGHTS.notebookOriginal;
  const walk = EXPERIMENTS.walkForward as { testYear: number; accuracy: number; nTest: number }[];
  const ablate = EXPERIMENTS.ablationOriginal as { name: string; accuracy: number; f1Macro: number }[];
  const split = EXPERIMENTS.splitComparison as { protocol: string; accuracy: number }[];
  const leak = EXPERIMENTS.leakageAudit as { feature: string; status: string; detail: string }[];
  const cal = EXPERIMENTS.calibration as { predicted: number; actual: number | null; n: number }[];
  const rec = EXPERIMENTS.reconstructionRandomHoldout as {
    accuracy: number;
    f1Macro: number;
    nTest: number;
    confusion: number[][];
    report: { class: number; precision: number; recall: number; f1: number; support: number }[];
  };

  const notebookBars = [
    { name: "Random Forest", acc: nb.randomForestTest.accuracy },
    { name: "AdaBoost", acc: nb.adaboostTest.accuracy },
    { name: "XGBoost", acc: nb.groupStageUntunedXgbTest.accuracy },
    { name: "MLP", acc: nb.mlpTest.accuracy },
    { name: "XGB tuned", acc: nb.groupStageHoldout.accuracy },
  ];
  const koBars = [
    { name: "AdaBoost", acc: nb.knockout.adaboost.accuracy },
    { name: "Random Forest", acc: nb.knockout.randomForest.accuracy },
    { name: "XGBoost", acc: nb.knockout.xgboost.accuracy },
    { name: "MLP", acc: nb.knockout.mlp.accuracy },
  ];

  return (
    <div>
      <PageHeader
        kicker="Model analysis"
        title="Numbers from the notebooks, plus a reconstruction you can run"
        lede="Hold-out figures with 404 one-hot columns are quoted from Modeling_QFIFA2022.ipynb. The logistic reconstruction uses only the five numeric differentials so it can run in the browser."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardKicker>Original algorithm</CardKicker>
          <CardTitle>XGBoost</CardTitle>
          <p className="mt-2 text-sm text-muted">
            γ=0.01, lr=0.01, 300 trees, depth 4, multi:softprob. Pipeline: OneHot(Team1,Team2) +
            StandardScaler(with_mean=False).
          </p>
        </Card>
        <Card>
          <CardKicker>3-class holdout</CardKicker>
          <p className="font-display text-4xl tabular">{pct(nb.groupStageHoldout.accuracy, 0)}</p>
          <p className="text-sm text-muted">n={nb.groupStageHoldout.nTest} · draw F1 = 0.02</p>
        </Card>
        <Card>
          <CardKicker>Knockout protocol</CardKicker>
          <p className="font-display text-4xl tabular">{pct(nb.knockout.xgboost.accuracy, 0)}</p>
          <p className="text-sm text-muted">Draws dropped · n={nb.knockout.xgboost.nTest}</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardKicker>Notebook · group-stage models</CardKicker>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={notebookBars}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                <YAxis domain={[0.5, 0.7]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                <Tooltip formatter={(v: number) => pct(v)} />
                <Bar dataKey="acc" radius={[6, 6, 0, 0]}>
                  {notebookBars.map((e) => (
                    <Cell key={e.name} fill={e.name.includes("tuned") ? "var(--color-accent)" : "var(--color-even)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardKicker>Notebook · knockout (no draws)</CardKicker>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={koBars}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                <YAxis domain={[0.7, 0.85]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                <Tooltip formatter={(v: number) => pct(v)} />
                <Bar dataKey="acc" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardKicker>Reconstruction logistic</CardKicker>
        <CardTitle>
          {pct(rec.accuracy)} holdout · F1-macro {rec.f1Macro.toFixed(3)} · n={rec.nTest}
        </CardTitle>
        <p className="mt-2 text-sm text-muted">
          Same 9,321-row training.csv, five differentials, no team-name dummies. Lands next to the
          tuned XGBoost 62% — most of the original lift was FIFA rank, not boosting.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-muted">
                <th className="p-2" />
                <th className="p-2">Pred lose</th>
                <th className="p-2">Pred win</th>
                <th className="p-2">Pred draw</th>
              </tr>
            </thead>
            <tbody>
              {["True lose", "True win", "True draw"].map((lab, i) => (
                <tr key={lab}>
                  <th className="p-2 text-left text-muted">{lab}</th>
                  {rec.confusion[i].map((c, j) => (
                    <td key={j} className="p-2 tabular">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardKicker>Ablation</CardKicker>
          <ul className="mt-3 space-y-3">
            {ablate.map((r) => (
              <li key={r.name}>
                <div className="flex justify-between text-sm">
                  <span>{r.name}</span>
                  <span className="tabular">{pct(r.accuracy)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div className="h-full bg-accent" style={{ width: `${r.accuracy * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardKicker>Walk-forward</CardKicker>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={walk}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="testYear" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                <YAxis domain={[0.4, 0.7]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                <Tooltip formatter={(v: number) => pct(v)} />
                <Bar dataKey="accuracy" fill="var(--color-even)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {split.map((s) => (
              <li key={s.protocol}>
                {pct(s.accuracy)} · {s.protocol}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardKicker>Calibration</CardKicker>
        <CardTitle>When the logistic says ~70%, how often does Team 1 win?</CardTitle>
        <ul className="mt-4 grid gap-3 sm:grid-cols-5">
          {cal.map((c) => (
            <li key={c.predicted} className="rounded-[16px] bg-elevated p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Pred {pct(c.predicted, 0)}</p>
              <p className="font-display text-2xl tabular">{c.actual == null ? "—" : pct(c.actual, 0)}</p>
              <p className="text-xs text-subtle">n={c.n}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6">
        <CardKicker>Mandatory · limitations</CardKicker>
        <CardTitle>Leakage audit</CardTitle>
        <ul className="mt-4 space-y-3">
          {leak.map((item) => (
            <li key={item.feature} className="rounded-[16px] bg-elevated p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{item.feature}</p>
                <Badge tone={item.status === "ok" ? "win" : item.status === "limitation" || item.status === "protocol" ? "muted" : "loss"}>
                  {item.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{item.detail}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
