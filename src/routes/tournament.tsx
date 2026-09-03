import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ORIGINAL, TOURNAMENT, getTeam, predictMatch, simulateTournament } from "@/lib/ml/engine";
import { TeamCrest } from "@/components/team-crest";
import { ProbabilityBar } from "@/components/probability-bar";
import { pct } from "@/lib/utils";

export const Route = createFileRoute("/tournament")({ component: TournamentPage });

function MatchCard({
  teamA,
  teamB,
  score,
  winner,
  penalties,
}: {
  teamA: string;
  teamB: string;
  score?: string;
  winner?: string;
  penalties?: string | null;
}) {
  const a = getTeam(teamA);
  const b = getTeam(teamB);
  const live = a && b ? predictMatch(teamA, teamB) : null;
  return (
    <div className="rounded-[20px] bg-elevated p-3">
      <div className="flex items-center justify-between gap-2">
        {a ? <TeamCrest team={a} size="sm" /> : teamA}
        <span className="font-display tabular text-sm">{score ?? "vs"}</span>
        {b ? <TeamCrest team={b} size="sm" /> : teamB}
      </div>
      {winner ? (
        <p className="mt-2 text-xs text-muted">
          Winner {winner}
          {penalties ? ` · pens ${penalties}` : ""}
        </p>
      ) : null}
      {live ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
          <div className="h-full bg-accent" style={{ width: `${(live.original.win * 100).toFixed(1)}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function TournamentPage() {
  const [sims, setSims] = React.useState<ReturnType<typeof simulateTournament> | null>(null);
  const [filter, setFilter] = React.useState<"all" | "correct" | "incorrect">("all");
  const group = ORIGINAL.groupStage.filter((g) => {
    if (filter === "correct") return g.correct;
    if (filter === "incorrect") return !g.correct;
    return true;
  });
  const br = TOURNAMENT.actualBracket;

  return (
    <div>
      <PageHeader
        kicker="Tournament explorer"
        title="The bracket that happened, and the one the notebook implied"
        lede="Information cutoff 14 Jun 2022. Actual Qatar 2022 results are used only to score predictions — they never enter training."
      />

      <Tabs defaultValue="actual">
        <TabsList>
          <TabsTrigger value="actual">Actual knockout</TabsTrigger>
          <TabsTrigger value="implied">Model-implied path</TabsTrigger>
          <TabsTrigger value="results">Historical table</TabsTrigger>
          <TabsTrigger value="mc">Tournament Monte Carlo</TabsTrigger>
        </TabsList>

        <TabsContent value="actual" className="mt-6 space-y-6">
          <section>
            <h2 className="mb-3 font-display text-2xl">Round of 16</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {br.roundOf16.map((m) => (
                <MatchCard key={m.id} {...m} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 font-display text-2xl">Quarterfinals</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {br.quarterfinals.map((m) => (
                <MatchCard key={m.id} {...m} />
              ))}
            </div>
          </section>
          <section className="grid gap-3 md:grid-cols-2">
            <div>
              <h2 className="mb-3 font-display text-2xl">Semifinals</h2>
              {br.semifinals.map((m) => (
                <MatchCard key={m.id} {...m} />
              ))}
            </div>
            <div className="space-y-3">
              <h2 className="font-display text-2xl">Final & third</h2>
              <MatchCard {...br.final} />
              <MatchCard {...br.thirdPlace} />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="implied" className="mt-6">
          <Card>
            <CardKicker>From Final_Prediction.ipynb</CardKicker>
            <CardTitle>Germany vs Portugal was the printed final pairing</CardTitle>
            <p className="mt-2 text-sm text-muted">
              That path assumes the model's group winners. The winner cell for the final was commented
              out in the notebook. The actual-finalists cell did run: France 50.0%, Argentina 27.0%.
            </p>
            <div className="mt-4 space-y-4">
              {Object.entries(ORIGINAL.modelImpliedBracket).map(([round, matches]) => (
                <div key={round}>
                  <h3 className="mb-2 font-display text-xl capitalize">{round}</h3>
                  <ul className="space-y-2">
                    {(Array.isArray(matches) ? matches : [matches]).map((m, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-elevated px-3 py-2 text-sm">
                        <span>
                          {m.teamA} vs {m.teamB}
                        </span>
                        <span className="text-muted">{m.predicted ?? m.note ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardKicker>Group stage</CardKicker>
                <CardTitle>
                  {ORIGINAL.groupStageAccuracy.correct}/{ORIGINAL.groupStageAccuracy.n} strict hits ·{" "}
                  {pct(ORIGINAL.groupStageAccuracy.accuracy)}
                </CardTitle>
              </div>
              <div className="flex gap-2">
                {(["all", "correct", "incorrect"] as const).map((f) => (
                  <Button key={f} size="sm" variant={filter === f ? "solid" : "outline"} onClick={() => setFilter(f)}>
                    {f}
                  </Button>
                ))}
              </div>
            </div>
            <p className="mb-4 text-sm text-muted">{ORIGINAL.groupStageAccuracy.protocol}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <th className="py-2 font-medium">Match</th>
                    <th className="font-medium">Predicted</th>
                    <th className="font-medium">Actual</th>
                    <th className="font-medium">Score</th>
                    <th className="font-medium">Hit</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((g) => (
                    <tr key={`${g.teamA}-${g.teamB}`} className="border-t border-line">
                      <td className="py-2">
                        {g.teamA} vs {g.teamB}
                      </td>
                      <td>
                        {g.predicted}{" "}
                        <span className="text-muted">{g.pA != null ? pct(Math.max(g.pA, g.pB)) : ""}</span>
                      </td>
                      <td>{g.actual}</td>
                      <td className="tabular">{g.score}</td>
                      <td>
                        <Badge tone={g.correct ? "win" : "loss"}>{g.correct ? "Hit" : "Miss"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="mc" className="mt-6">
          <Card>
            <CardKicker>Knockout replay</CardKicker>
            <CardTitle>1,000 simulated tournaments from the actual R16 field</CardTitle>
            <p className="mt-2 text-sm text-muted">
              Each match is a Poisson draw plus extra-time and a coin-flip penalty. This is a 2026
              engine experiment, labelled as such — not the 2022 XGBoost.
            </p>
            <Button className="mt-4" onClick={() => setSims(simulateTournament(1000, 2022))}>
              Run 1,000 tournaments
            </Button>
            {sims ? (
              <div className="mt-6 grid gap-6 md:grid-cols-3">
                {[
                  ["Champion", sims.champion],
                  ["Finalist", sims.finalist],
                  ["Semifinal", sims.semifinal],
                ].map(([label, rows]) => (
                  <div key={label as string}>
                    <h3 className="mb-2 font-display text-xl">{label as string}</h3>
                    <ul className="space-y-2">
                      {(rows as { team: string; p: number }[]).slice(0, 8).map((r) => (
                        <li key={r.team}>
                          <div className="flex justify-between text-sm">
                            <span>{r.team}</span>
                            <span className="tabular text-muted">{pct(r.p)}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                            <div className="h-full bg-accent" style={{ width: `${r.p * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardKicker>Actual final, original probabilities</CardKicker>
        <ProbabilityBar a={0.27} draw={0.23} b={0.5} labelA="Argentina" labelB="France" />
        <p className="mt-3 text-sm text-muted">
          Printed 17–18 Dec 2022 window in the student notebook. Argentina won on penalties.
        </p>
      </Card>
    </div>
  );
}
