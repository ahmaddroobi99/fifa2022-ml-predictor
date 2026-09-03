import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardKicker, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/methodology")({ component: MethodologyPage });

const STEPS = [
  {
    title: "Raw data",
    body: "international_matches.csv (23,921 rows, 1993–14 Jun 2022) and players_22.csv (19,239 FIFA 22 players). Source: the 2022 course dump, not a live API.",
  },
  {
    title: "Cleaning",
    body: "Original notebooks filled GK/DEF/OFF/MID NAs with the team mean across the whole series, then remaining holes with 50. Qatar has zero FIFA 22 players.",
  },
  {
    title: "Feature engineering (2022)",
    body: "Team1/Team2 FIFA rank, goalkeeper, defense, offense, midfield. Labels: 1=Team1 win, 0=lose, 2=draw. Team names were one-hot encoded (404 columns).",
  },
  {
    title: "Feature engineering (2026 lab)",
    body: "Causal Elo (K=20), last-5 weighted form, Team DNA (mean/std/top-3/depth/star concentration from FIFA 22), attack×opponent-defense differentials.",
  },
  {
    title: "Training",
    body: "Original: XGBClassifier after GridSearchCV. Reconstruction: multinomial logistic on the five numeric diffs so inference is deterministic in the browser.",
  },
  {
    title: "Evaluation",
    body: "Notebook: random holdout. Lab: the same plus chronological split and year-by-year walk-forward. Draws are the failure mode (F1 ≈ 0.02).",
  },
  {
    title: "Prediction",
    body: "Original inference reordered sides so the higher FIFA 22 potential (or better rank) sat in Team1. The lab defaults to the order you pick and says so.",
  },
];

function MethodologyPage() {
  return (
    <div>
      <PageHeader
        kicker="Methodology"
        title="From a course notebook to a lab you can interrogate"
        lede="Two layers share data and disagree on protocol. The 2022 layer is frozen to the notebooks. The 2026 layer is labelled whenever it uses snapshot Elo or DNA."
      />

      <div className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-px before:bg-line">
        {STEPS.map((s, i) => (
          <div key={s.title} className="relative grid grid-cols-[32px_1fr] gap-4">
            <span className="grid size-8 place-items-center rounded-full bg-accent text-xs text-accent-fg">
              {i + 1}
            </span>
            <Card className="p-4 sm:p-5">
              <CardTitle className="text-lg">{s.title}</CardTitle>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </Card>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardKicker>Original expected-goals analogue</CardKicker>
          <CardTitle>Classification, not a score model</CardTitle>
          <p className="mt-2 text-sm text-muted">
            The 2022 project predicted a three-way class, not goals. The lab adds a Poisson layer:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-[16px] bg-elevated p-3 font-mono text-xs text-muted">
{`λ_A = 1.25 · (xgA_att / 1.25) · (xgB_def / 1.25)
        · (off_A / def_B) · form_A
P(G_A = k) ~ Poisson(λ_A)`}
          </pre>
        </Card>
        <Card>
          <CardKicker>Elo</CardKicker>
          <CardTitle>Updated after every match, never before</CardTitle>
          <pre className="mt-3 overflow-x-auto rounded-[16px] bg-elevated p-3 font-mono text-xs text-muted">
{`E_A = 1 / (1 + 10^((R_B - R_A)/400))
R_A ← R_A + 20 · (S_A - E_A)
S_A ∈ {1, 0.5, 0}`}
          </pre>
          <p className="mt-2 text-sm text-muted">Start 1500. Dump ends 14 Jun 2022. Argentina 1914, France 1882 in this reconstruction.</p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardKicker>Star concentration</CardKicker>
        <p className="text-sm text-muted">
          mean(top-3 overall) / mean(squad overall). A Messi-shaped squad and a flat squad can share
          an average and still differ here. Depth index is bench mean over XI mean.
        </p>
      </Card>
    </div>
  );
}
