import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { Card, CardKicker, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DATASET, TEAMS } from "@/lib/ml/engine";
import { TeamCrest } from "@/components/team-crest";
import { fmt } from "@/lib/utils";

export const Route = createFileRoute("/data")({ component: DataPage });

function DataPage() {
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(0);
  const stats = DATASET.stats;
  const yearly = DATASET.yearly as { year: string; matches: number; wins: number; draws: number; losses: number; goals: number }[];
  const matches = DATASET.matches as {
    date: string;
    home: string;
    away: string;
    hg: number;
    ag: number;
    tournament: string;
    result: string;
  }[];
  const filtered = matches.filter(
    (m) =>
      m.home.toLowerCase().includes(q.toLowerCase()) ||
      m.away.toLowerCase().includes(q.toLowerCase()) ||
      m.tournament.toLowerCase().includes(q.toLowerCase()),
  );
  const pageSize = 12;
  const slice = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const rd = stats.internationalMatches.resultDistribution;

  return (
    <div>
      <PageHeader
        kicker="Data explorer"
        title="The tables the 2022 notebooks actually used"
        lede="Raw FIFA 22 (19k players) and the full 23k-match dump stay out of the browser. What you see here is aggregated or sampled so the lab stays fast."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["International matches", stats.internationalMatches.rows, "1993-08-08 → 2022-06-14"],
          ["Training rows", stats.training.rows, stats.training.label],
          ["FIFA 22 players", stats.players22.rows, `${stats.players22.wcPlayers} from WC nations`],
          ["Qatar in FIFA 22", stats.players22.qatarPlayers, "Imputed in the original fill"],
        ].map(([l, v, n]) => (
          <Card key={l as string}>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{l as string}</p>
            <p className="font-display text-3xl tabular">{(v as number).toLocaleString?.() ?? v}</p>
            <p className="text-xs text-subtle">{n as string}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardKicker>Volume over time</CardKicker>
        <CardTitle>Matches per year in international_matches.csv</CardTitle>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={yearly}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "var(--color-muted)", fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
              <Tooltip />
              <Area dataKey="matches" stroke="var(--color-accent)" fill="color-mix(in oklab, var(--color-accent) 30%, transparent)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-sm text-muted">
          Home result mix: win {rd.Win.toLocaleString()} · lose {rd.Lose.toLocaleString()} · draw{" "}
          {rd.Draw.toLocaleString()}. That home skew is why the original inference step reordering
          Team1 toward the favourite is so consequential.
        </p>
      </Card>

      <Card className="mt-6">
        <CardKicker>32 squads · June 2022 snapshot</CardKicker>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {TEAMS.map((t) => (
            <div key={t.name} className="flex items-center justify-between gap-3 rounded-[16px] bg-elevated px-3 py-2">
              <TeamCrest team={t} size="sm" />
              <div className="text-right text-xs text-muted">
                <p>Elo {Math.round(t.elo)}</p>
                <p>OVR {fmt(t.squadOverall, 1)} · DNA n={t.dna.playerCount}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6">
        <CardKicker>Recent WC-nation matches</CardKicker>
        <CardTitle>Paginated sample (not the full 23,921 rows)</CardTitle>
        <Input
          className="mt-3 max-w-md"
          placeholder="Filter team or competition…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="py-2 font-medium">Date</th>
                <th className="font-medium">Match</th>
                <th className="font-medium">Score</th>
                <th className="font-medium">Tournament</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((m, i) => (
                <tr key={`${m.date}-${m.home}-${i}`} className="border-t border-line">
                  <td className="py-2 tabular">{m.date}</td>
                  <td>
                    {m.home} vs {m.away}
                  </td>
                  <td className="tabular">
                    {m.hg}–{m.ag}
                  </td>
                  <td className="text-muted">{m.tournament}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            {page + 1} / {pages} · {filtered.length} rows
          </span>
          <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </Card>

      <Card className="mt-6">
        <CardKicker>Missingness</CardKicker>
        <p className="text-sm text-muted">
          FIFA video-game squad scores are empty on a majority of historical rows (GK home missing
          15,542 / 23,921). The original fill used per-team means, then 50. That is a first-class
          limitation, not a footnote.
        </p>
      </Card>
    </div>
  );
}
