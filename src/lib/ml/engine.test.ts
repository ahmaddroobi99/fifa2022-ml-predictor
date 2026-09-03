import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORIGINAL,
  TEAM_NAMES,
  getTeam,
  originalFeatures,
  predictMatch,
  predictOriginal,
  simulateMatch,
} from "./engine.ts";

describe("FIFA 2022 ML engine", () => {
  it("loads 32 World Cup teams", () => {
    assert.equal(TEAM_NAMES.length, 32);
    assert.ok(getTeam("Argentina"));
    assert.ok(getTeam("France"));
    assert.equal(getTeam("Qatar")?.dna.imputed, true);
  });

  it("rejects unknown and identical teams", () => {
    assert.throws(() => predictMatch("Argentina", "Narnia"), /Unknown/);
    assert.throws(() => predictMatch("Argentina", "Argentina"), /different/);
  });

  it("returns a valid probability simplex for the original logistic", () => {
    const a = getTeam("Argentina")!;
    const b = getTeam("France")!;
    const p = predictOriginal(a, b);
    const s = p.win + p.draw + p.lose;
    assert.ok(Math.abs(s - 1) < 1e-6);
    assert.ok(p.win >= 0 && p.draw >= 0 && p.lose >= 0);
    assert.equal(originalFeatures(a, b).length, 5);
  });

  it("Monte Carlo frequencies are a simplex and reproducible for a seed", () => {
    const a = getTeam("Brazil")!;
    const b = getTeam("Cameroon")!;
    const s1 = simulateMatch(a, b, {
      attackA: 0,
      defenseA: 0,
      midfieldA: 0,
      formA: 0,
      attackB: 0,
      defenseB: 0,
      midfieldB: 0,
      formB: 0,
      homeAdvantage: false,
      nSims: 2000,
    });
    const s2 = simulateMatch(a, b, {
      attackA: 0,
      defenseA: 0,
      midfieldA: 0,
      formA: 0,
      attackB: 0,
      defenseB: 0,
      midfieldB: 0,
      formB: 0,
      homeAdvantage: false,
      nSims: 2000,
    });
    assert.equal(s1.pWin, s2.pWin);
    assert.ok(Math.abs(s1.pWin + s1.pDraw + s1.pLose - 1) < 1e-9);
  });

  it("preserves original notebook group-stage accuracy 26/48", () => {
    assert.equal(ORIGINAL.groupStage.length, 48);
    assert.equal(ORIGINAL.groupStageAccuracy.correct, 26);
    const final = ORIGINAL.actualPairsWithOriginalProba.find((m) => m.round === "Final");
    assert.equal(final?.predicted, "France");
    assert.equal(final?.actual, "Argentina");
    assert.equal(final?.pB, 0.5);
  });
});
