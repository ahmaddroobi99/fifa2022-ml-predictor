export type FormSlice = {
  played: number;
  winRate: number;
  gd: number;
  gf: number;
  ga: number;
  weighted: number;
};

export type TeamDna = {
  playerCount: number;
  squadN: number;
  overallMean: number | null;
  overallStd: number | null;
  overallTop3: number | null;
  overallP90: number | null;
  overallP25: number | null;
  ageMean: number | null;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physic: number | null;
  attack: number | null;
  midfield: number | null;
  defense: number | null;
  gk: number | null;
  starConcentration: number;
  depthIndex: number;
  xiMean: number | null;
  benchMean: number | null;
  valueSumM: number;
  topPlayers: { name: string; pos: string; overall: number; age: number }[];
  imputed: boolean;
  imputeNote?: string;
};

export type Team = {
  id: string;
  name: string;
  code: string;
  group: string;
  confederation: string;
  colors: { primary: string; secondary: string };
  fifaRank: number;
  rankDate: string;
  goalkeeper: number;
  defense: number;
  offense: number;
  midfield: number;
  squadOverall: number;
  squadPotential: number;
  elo: number;
  form5: FormSlice;
  form10: FormSlice;
  record: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    gf: number;
    ga: number;
    winRate: number;
  };
  dna: TeamDna;
  eloTrajectory: { date: string; elo: number }[];
};

export type OutcomeProba = {
  lose: number;
  draw: number;
  win: number;
};

export type Scenario = {
  attackA: number;
  defenseA: number;
  midfieldA: number;
  formA: number;
  attackB: number;
  defenseB: number;
  midfieldB: number;
  formB: number;
  homeAdvantage: boolean;
  nSims: number;
};

export const DEFAULT_SCENARIO: Scenario = {
  attackA: 0,
  defenseA: 0,
  midfieldA: 0,
  formA: 0,
  attackB: 0,
  defenseB: 0,
  midfieldB: 0,
  formB: 0,
  homeAdvantage: false,
  nSims: 8000,
};
