import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardKicker, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <div>
      <PageHeader
        kicker="Project provenance"
        title="A 2022 BSc notebook, reconstructed as a lab"
        lede="Originally developed as a Computer Engineering course project at An-Najah National University. This platform preserves that work and is explicit about what was added in 2026."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardKicker>Original</CardKicker>
          <CardTitle>World Cup 2022 match prediction</CardTitle>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Authors in the notebooks: Droobi & Nabeel</li>
            <li>Stack: Python, Jupyter, pandas, scikit-learn, XGBoost, Keras</li>
            <li>Goal: last knockout matches, 17–18 Dec 2022</li>
            <li>
              Repo:{" "}
              <a className="text-fg underline" href="https://github.com/ahmaddroobi99/WordCup2022_WinnerPrediction_ML">
                ahmaddroobi99/WordCup2022_WinnerPrediction_ML
              </a>
            </li>
          </ul>
        </Card>
        <Card>
          <CardKicker>This platform</CardKicker>
          <CardTitle>FIFA 2022 ML Lab</CardTitle>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Historical reconstruction — not current research</li>
            <li>Not a betting product, not a gambling interface</li>
            <li>Original notebooks copied to notebooks/original/ and not overwritten</li>
            <li>Metrics that came from notebooks are labelled as such</li>
            <li>
              Platform repo:{" "}
              <a className="text-fg underline" href="https://github.com/ahmaddroobi99/fifa2022-ml-predictor">
                ahmaddroobi99/fifa2022-ml-predictor
              </a>
            </li>
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardKicker>What is new in 2026</CardKicker>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
          <li>Team DNA from FIFA 22 player distributions, not just a single overall</li>
          <li>Causal Elo and weighted form</li>
          <li>Monte Carlo Poisson scorelines and tournament rollouts</li>
          <li>Counterfactual sliders and a ±5% stress matrix</li>
          <li>Walk-forward evaluation and a written leakage audit</li>
        </ul>
      </Card>

      <Card className="mt-4">
        <CardKicker>Licensing of visuals</CardKicker>
        <p className="text-sm text-muted">
          No FIFA, EA, or national-team trademarks are used. Squad identity is a colour chip and FIFA
          country code. Kit colours are approximate and descriptive. Player names in Team DNA come
          from the FIFA 22 table bundled with the original course dataset.
        </p>
      </Card>
    </div>
  );
}
