import teamsPayload from "../../data/teams.json" with { type: "json" };
import weights from "../../data/model-weights.json" with { type: "json" };
import originalPredictions from "../../data/original-predictions.json" with { type: "json" };
import tournament from "../../data/tournament.json" with { type: "json" };
import experiments from "../../data/experiments.json" with { type: "json" };
import datasetStats from "../../data/dataset-stats.json" with { type: "json" };
import { hashSeed, mulberry32, poissonPmf, poissonSample, softmax } from "./math.ts";
import { DEFAULT_SCENARIO, type Scenario, type Team } from "./types.ts";

export const TEAMS = teamsPayload.teams as Team[];
export const TEAM_BY_NAME = Object.fromEntries(TEAMS.map((t) => [t.name, t]));
export const TEAM_NAMES = TEAMS.map((t) => t.name);
export const ORIGINAL = originalPredictions;
export const TOURNAMENT = tournament;
export const EXPERIMENTS = experiments;
export const DATASET = datasetStats;
export const WEIGHTS = weights;
export const CUTOFF = teamsPayload.cutoff as string;

const origW = weights.original.W as number[][];
const origB = weights.original.b as number[];
const origMean = weights.original.mean as number[];
const origStd = weights.original.std as number[];

const enhW = weights.enhanced.W as number[][];
const enhB = weights.enhanced.b as number[];
const enhMean = weights.enhanced.mean as number[];
const enhStd = weights.enhanced.std as number[];
const xg = weights.xg as Record<string, { attack: number; defense: number }>;

export function getTeam(name: string): Team | undefined {
  return TEAM_BY_NAME[name];
}

function z(values: number[], mean: number[], std: number[]) {
  return values.map((v, i) => (v - mean[i]) / (std[i] || 1));
}

function linearProba(xStd: number[], W: number[][], b: number[]) {
  const k = b.length;
  const logits = Array.from({ length: k }, (_, j) => {
    let s = b[j];
    for (let i = 0; i < xStd.length; i++) s += xStd[i] * W[i][j];
    return s;
  });
  const p = softmax(logits);
  return { lose: p[0], win: p[1], draw: p[2] };
}

function applyScenario(team: Team, side: "A" | "B", s: Scenario) {
  const atk = side === "A" ? s.attackA : s.attackB;
  const def = side === "A" ? s.defenseA : s.defenseB;
  const mid = side === "A" ? s.midfieldA : s.midfieldB;
  const form = side === "A" ? s.formA : s.formB;
  return {
    offense: team.offense * (1 + atk),
    defense: team.defense * (1 + def),
    midfield: team.midfield * (1 + mid),
    gk: team.goalkeeper,
    form: Math.min(1, Math.max(0, team.form5.weighted * (1 + form))),
    dnaAtk: (team.dna.attack ?? 70) * (1 + atk),
    dnaDef: (team.dna.defense ?? 70) * (1 + def),
    dnaMid: (team.dna.midfield ?? 70) * (1 + mid),
  };
}

export function originalFeatures(a: Team, b: Team, s: Scenario = DEFAULT_SCENARIO) {
  const A = applyScenario(a, "A", s);
  const B = applyScenario(b, "B", s);
  return [
    b.fifaRank - a.fifaRank,
    A.gk - B.gk,
    A.defense - B.defense,
    A.offense - B.offense,
    A.midfield - B.midfield,
  ];
}

export function enhancedFeatures(a: Team, b: Team, s: Scenario = DEFAULT_SCENARIO) {
  const A = applyScenario(a, "A", s);
  const B = applyScenario(b, "B", s);
  return [
    b.fifaRank - a.fifaRank,
    A.offense - B.defense,
    A.defense - B.offense,
    A.midfield - B.midfield,
    A.gk - B.gk,
    a.elo - b.elo,
    A.form - B.form,
    A.dnaAtk - B.dnaDef,
    A.dnaDef - B.dnaAtk,
    a.dna.starConcentration - b.dna.starConcentration,
    a.dna.depthIndex - b.dna.depthIndex,
    a.squadOverall - b.squadOverall,
  ];
}

export function predictOriginal(a: Team, b: Team, s: Scenario = DEFAULT_SCENARIO) {
  return linearProba(z(originalFeatures(a, b, s), origMean, origStd), origW, origB);
}

export function predictEnhanced(a: Team, b: Team, s: Scenario = DEFAULT_SCENARIO) {
  return linearProba(z(enhancedFeatures(a, b, s), enhMean, enhStd), enhW, enhB);
}

export function predictElo(a: Team, b: Team) {
  const expected = 1 / (1 + 10 ** ((b.elo - a.elo) / 400));
  const draw = 0.22 + 0.08 * (1 - Math.abs(expected - 0.5) * 2);
  const rest = 1 - draw;
  return { win: expected * rest, draw, lose: (1 - expected) * rest };
}

export function expectedGoals(a: Team, b: Team, s: Scenario = DEFAULT_SCENARIO) {
  const A = applyScenario(a, "A", s);
  const B = applyScenario(b, "B", s);
  const xgA = xg[a.name] ?? { attack: 1.2, defense: 1.2 };
  const xgB = xg[b.name] ?? { attack: 1.2, defense: 1.2 };
  const home = s.homeAdvantage ? 1.12 : 1;
  const formA = 1 + 0.35 * (A.form - 0.5);
  const formB = 1 + 0.35 * (B.form - 0.5);
  const ratingA = (A.offense / 80) * (80 / B.defense);
  const ratingB = (B.offense / 80) * (80 / A.defense);
  const lambdaA = Math.max(
    0.35,
    xgA.attack * ratingA * formA * home * (xgB.defense / 1.2),
  );
  const lambdaB = Math.max(
    0.35,
    xgB.attack * ratingB * formB * (xgA.defense / 1.2),
  );
  return { lambdaA, lambdaB };
}

export type SimResult = {
  n: number;
  pWin: number;
  pDraw: number;
  pLose: number;
  meanA: number;
  meanB: number;
  scorelines: { score: string; n: number; p: number }[];
  heatmap: number[][];
  sample: { a: number; b: number }[];
};

export function simulateMatch(a: Team, b: Team, s: Scenario = DEFAULT_SCENARIO): SimResult {
  const { lambdaA, lambdaB } = expectedGoals(a, b, s);
  const n = Math.max(200, Math.min(20000, Math.round(s.nSims)));
  const rand = mulberry32(hashSeed(a.name, b.name) ^ Math.round(s.attackA * 1000 + s.nSims));
  let w = 0,
    d = 0,
    l = 0,
    sa = 0,
    sb = 0;
  const counts = new Map<string, number>();
  const heat = Array.from({ length: 6 }, () => Array(6).fill(0));
  const sample: { a: number; b: number }[] = [];
  for (let i = 0; i < n; i++) {
    const ga = poissonSample(lambdaA, rand);
    const gb = poissonSample(lambdaB, rand);
    sa += ga;
    sb += gb;
    if (ga > gb) w += 1;
    else if (ga === gb) d += 1;
    else l += 1;
    const key = `${ga}-${gb}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (ga < 6 && gb < 6) heat[ga][gb] += 1;
    if (i < 24) sample.push({ a: ga, b: gb });
  }
  const scorelines = [...counts.entries()]
    .map(([score, c]) => ({ score, n: c, p: c / n }))
    .sort((x, y) => y.n - x.n)
    .slice(0, 8);
  return {
    n,
    pWin: w / n,
    pDraw: d / n,
    pLose: l / n,
    meanA: sa / n,
    meanB: sb / n,
    scorelines,
    heatmap: heat.map((row) => row.map((c) => c / n)),
    sample,
  };
}

export function analyticScoreMatrix(a: Team, b: Team, s: Scenario = DEFAULT_SCENARIO) {
  const { lambdaA, lambdaB } = expectedGoals(a, b, s);
  const m = 6;
  const heat: number[][] = [];
  let pWin = 0,
    pDraw = 0,
    pLose = 0;
  for (let i = 0; i < m; i++) {
    const row: number[] = [];
    for (let j = 0; j < m; j++) {
      const p = poissonPmf(i, lambdaA) * poissonPmf(j, lambdaB);
      row.push(p);
      if (i > j) pWin += p;
      else if (i === j) pDraw += p;
      else pLose += p;
    }
    heat.push(row);
  }
  return { heat, pWin, pDraw, pLose, lambdaA, lambdaB };
}

export type CouncilMember = {
  name: string;
  pick: string;
  pWin: number;
  pDraw: number;
  pLose: number;
  note: string;
};

export type MatchupRow = {
  dim: string;
  a: number;
  b: number;
  advantage: "A" | "B" | "even";
  delta: number;
};

export function matchupMatrix(a: Team, b: Team): MatchupRow[] {
  const rows: { dim: string; a: number; b: number }[] = [
    { dim: "FIFA rank (lower better)", a: a.fifaRank, b: b.fifaRank },
    { dim: "Elo (Jun 2022)", a: a.elo, b: b.elo },
    { dim: "Squad overall", a: a.squadOverall, b: b.squadOverall },
    { dim: "Attack (FIFA score)", a: a.offense, b: b.offense },
    { dim: "Midfield", a: a.midfield, b: b.midfield },
    { dim: "Defense", a: a.defense, b: b.defense },
    { dim: "Goalkeeper", a: a.goalkeeper, b: b.goalkeeper },
    { dim: "DNA attack", a: a.dna.attack ?? 0, b: b.dna.attack ?? 0 },
    { dim: "DNA midfield", a: a.dna.midfield ?? 0, b: b.dna.midfield ?? 0 },
    { dim: "DNA defense", a: a.dna.defense ?? 0, b: b.dna.defense ?? 0 },
    { dim: "Pace", a: a.dna.pace ?? 0, b: b.dna.pace ?? 0 },
    { dim: "Star concentration", a: a.dna.starConcentration, b: b.dna.starConcentration },
    { dim: "Squad depth", a: a.dna.depthIndex, b: b.dna.depthIndex },
    { dim: "Recent form (wtd)", a: a.form5.weighted, b: b.form5.weighted },
  ];
  return rows.map((r) => {
    const invert = r.dim.startsWith("FIFA rank");
    const delta = invert ? r.b - r.a : r.a - r.b;
    const threshold = invert ? 1 : Math.abs(r.a) * 0.015 + 0.01;
    let advantage: "A" | "B" | "even" = "even";
    if (delta > threshold) advantage = "A";
    else if (delta < -threshold) advantage = "B";
    return { ...r, advantage, delta };
  });
}

export function explainDrivers(a: Team, b: Team) {
  const feats = enhancedFeatures(a, b);
  const names = weights.enhanced.features as string[];
  const imp = (weights.enhanced.importance as { feature: string; weight: number }[]) ?? [];
  const byName = Object.fromEntries(imp.map((x) => [x.feature, x.weight]));
  return names
    .map((name, i) => ({
      feature: name,
      value: feats[i],
      importance: byName[name] ?? 0,
      signed: feats[i] * (byName[name] ?? 0),
    }))
    .sort((x, y) => Math.abs(y.signed) - Math.abs(x.signed));
}

export function dnaSummary(a: Team, b: Team) {
  const rows = matchupMatrix(a, b);
  const aWins = rows.filter((r) => r.advantage === "A").map((r) => r.dim);
  const bWins = rows.filter((r) => r.advantage === "B").map((r) => r.dim);
  const leadA = aWins.slice(0, 3).join(", ") || "balanced profile";
  const leadB = bWins.slice(0, 3).join(", ") || "balanced profile";
  return `${a.name} leads on ${leadA}. ${b.name} leads on ${leadB}.`;
}

export type PredictionBundle = {
  teamA: Team;
  teamB: Team;
  original: ReturnType<typeof predictOriginal>;
  enhanced: ReturnType<typeof predictEnhanced>;
  elo: ReturnType<typeof predictElo>;
  sim: SimResult;
  xg: { lambdaA: number; lambdaB: number };
  council: CouncilMember[];
  matchup: MatchupRow[];
  drivers: ReturnType<typeof explainDrivers>;
  summary: string;
  notebook: {
    pA: number | null;
    pDraw: number | null;
    pB: number | null;
    predicted: string | null;
    actual?: string;
    score?: string;
    round?: string;
  } | null;
};

function pickName(p: { win: number; draw: number; lose: number }, a: string, b: string) {
  if (p.win >= p.lose && p.win >= p.draw) return a;
  if (p.lose >= p.win && p.lose >= p.draw) return b;
  return "Draw";
}

function findNotebook(a: string, b: string) {
  const pool = [
    ...ORIGINAL.groupStage,
    ...ORIGINAL.modelImpliedKnockout,
    ...ORIGINAL.actualPairsWithOriginalProba,
  ];
  return (
    pool.find((m) => m.teamA === a && m.teamB === b) ??
    pool.find((m) => m.teamA === b && m.teamB === a) ??
    null
  );
}

export function predictMatch(teamA: string, teamB: string, s: Scenario = DEFAULT_SCENARIO): PredictionBundle {
  const a = getTeam(teamA);
  const b = getTeam(teamB);
  if (!a || !b) {
    throw new Error("Unknown team");
  }
  if (a.name === b.name) {
    throw new Error("Select two different teams");
  }
  const original = predictOriginal(a, b, s);
  const enhanced = predictEnhanced(a, b, s);
  const elo = predictElo(a, b);
  const sim = simulateMatch(a, b, s);
  const xgLam = expectedGoals(a, b, s);
  const council: CouncilMember[] = [
    {
      name: "2022-style logistic",
      pick: pickName(original, a.name, b.name),
      pWin: original.win,
      pDraw: original.draw,
      pLose: original.lose,
      note: "Five numeric differentials from training.csv",
    },
    {
      name: "Elo",
      pick: pickName(elo, a.name, b.name),
      pWin: elo.win,
      pDraw: elo.draw,
      pLose: elo.lose,
      note: "Causal Elo through 14 Jun 2022, K=20",
    },
    {
      name: "Monte Carlo",
      pick: pickName({ win: sim.pWin, draw: sim.pDraw, lose: sim.pLose }, a.name, b.name),
      pWin: sim.pWin,
      pDraw: sim.pDraw,
      pLose: sim.pLose,
      note: `${sim.n.toLocaleString()} Poisson matches`,
    },
    {
      name: "Enhanced DNA",
      pick: pickName(enhanced, a.name, b.name),
      pWin: enhanced.win,
      pDraw: enhanced.draw,
      pLose: enhanced.lose,
      note: "Adds Elo, form, FIFA 22 Team DNA — see leakage audit",
    },
  ];
  const nb = findNotebook(a.name, b.name);
  let notebook: PredictionBundle["notebook"] = null;
  if (nb) {
    const flipped = nb.teamA === b.name && nb.teamB === a.name;
    notebook = {
      pA: flipped ? (nb.pB as number | null) : (nb.pA as number | null),
      pDraw: nb.pDraw as number | null,
      pB: flipped ? (nb.pA as number | null) : (nb.pB as number | null),
      predicted: nb.predicted as string | null,
      actual: (nb as { actual?: string }).actual,
      score: (nb as { score?: string }).score,
      round: (nb as { round?: string }).round,
    };
  }
  return {
    teamA: a,
    teamB: b,
    original,
    enhanced,
    elo,
    sim,
    xg: xgLam,
    council,
    matchup: matchupMatrix(a, b),
    drivers: explainDrivers(a, b),
    summary: dnaSummary(a, b),
    notebook,
  };
}

export function stressTest(teamA: string, teamB: string) {
  const base = predictMatch(teamA, teamB);
  const shifts: { label: string; s: Partial<Scenario> }[] = [
    { label: "Baseline", s: {} },
    { label: "Attack −5%", s: { attackA: -0.05 } },
    { label: "Attack +5%", s: { attackA: 0.05 } },
    { label: "Defense −5%", s: { defenseA: -0.05 } },
    { label: "Defense +5%", s: { defenseA: 0.05 } },
    { label: "Form −5%", s: { formA: -0.05 } },
    { label: "Opp defense +5%", s: { defenseB: 0.05 } },
    { label: "Opp attack +5%", s: { attackB: 0.05 } },
  ];
  return shifts.map((sh) => {
    const bundle = predictMatch(teamA, teamB, { ...DEFAULT_SCENARIO, nSims: 4000, ...sh.s });
    return {
      label: sh.label,
      pWin: bundle.sim.pWin,
      pDraw: bundle.sim.pDraw,
      pLose: bundle.sim.pLose,
      pick: pickName(
        { win: bundle.original.win, draw: bundle.original.draw, lose: bundle.original.lose },
        bundle.teamA.name,
        bundle.teamB.name,
      ),
      delta: bundle.sim.pWin - base.sim.pWin,
    };
  });
}

export function counterfactualFlip(teamA: string, teamB: string) {
  const base = predictMatch(teamA, teamB);
  const basePick = pickName(base.original, teamA, teamB);
  const grid = [-0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12];
  const hits: { attackB: number; midfieldB: number; pick: string; pWin: number }[] = [];
  for (const atk of grid) {
    for (const mid of grid) {
      const b = predictMatch(teamA, teamB, { ...DEFAULT_SCENARIO, nSims: 1500, attackB: atk, midfieldB: mid });
      const pick = pickName(b.original, teamA, teamB);
      if (pick !== basePick) {
        hits.push({ attackB: atk, midfieldB: mid, pick, pWin: b.original.win });
      }
    }
  }
  hits.sort((x, y) => Math.abs(x.attackB) + Math.abs(x.midfieldB) - (Math.abs(y.attackB) + Math.abs(y.midfieldB)));
  return { basePick, firstFlip: hits[0] ?? null, nFlips: hits.length, tried: grid.length ** 2 };
}

const KO_BRACKET: [string, string][] = [
  ["Netherlands", "USA"],
  ["Argentina", "Australia"],
  ["France", "Poland"],
  ["England", "Senegal"],
  ["Japan", "Croatia"],
  ["Brazil", "Korea Republic"],
  ["Morocco", "Spain"],
  ["Portugal", "Switzerland"],
];

function koWinner(a: string, b: string, rand: () => number, s: Scenario) {
  const ta = getTeam(a)!;
  const tb = getTeam(b)!;
  const { lambdaA, lambdaB } = expectedGoals(ta, tb, s);
  let ga = poissonSample(lambdaA, rand);
  let gb = poissonSample(lambdaB, rand);
  if (ga !== gb) return ga > gb ? a : b;
  // extra time ~ 30/90 of remaining scoring
  ga += poissonSample(lambdaA * 0.33, rand);
  gb += poissonSample(lambdaB * 0.33, rand);
  if (ga !== gb) return ga > gb ? a : b;
  return rand() < 0.5 ? a : b;
}

export function simulateTournament(n = 1000, seed = 2022) {
  const rand = mulberry32(seed);
  const champ: Record<string, number> = {};
  const finalist: Record<string, number> = {};
  const semi: Record<string, number> = {};
  TEAMS.forEach((t) => {
    champ[t.name] = 0;
    finalist[t.name] = 0;
    semi[t.name] = 0;
  });
  for (let i = 0; i < n; i++) {
    const r16 = KO_BRACKET.map(([a, b]) => koWinner(a, b, rand, DEFAULT_SCENARIO));
    const qfPairs: [string, string][] = [
      [r16[4], r16[5]],
      [r16[0], r16[1]],
      [r16[6], r16[7]],
      [r16[2], r16[3]],
    ];
    const qf = qfPairs.map(([a, b]) => koWinner(a, b, rand, DEFAULT_SCENARIO));
    qf.forEach((t) => {
      semi[t] += 1;
    });
    const sf1 = koWinner(qf[1], qf[0], rand, DEFAULT_SCENARIO);
    const sf2 = koWinner(qf[3], qf[2], rand, DEFAULT_SCENARIO);
    finalist[sf1] += 1;
    finalist[sf2] += 1;
    const winner = koWinner(sf1, sf2, rand, DEFAULT_SCENARIO);
    champ[winner] += 1;
  }
  const table = (rec: Record<string, number>) =>
    Object.entries(rec)
      .filter(([, c]) => c > 0)
      .map(([team, c]) => ({ team, p: c / n }))
      .sort((a, b) => b.p - a.p);
  return { n, champion: table(champ), finalist: table(finalist), semifinal: table(semi) };
}

export { pickName, DEFAULT_SCENARIO };
