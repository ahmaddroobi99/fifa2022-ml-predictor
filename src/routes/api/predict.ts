import { createFileRoute } from "@tanstack/react-router";
import { predictMatch, TEAM_NAMES, WEIGHTS } from "@/lib/ml/engine";

export const Route = createFileRoute("/api/predict")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          teams: TEAM_NAMES,
          model: "logistic_original_features",
          informationCutoff: "2022-06-14",
        }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { team_a?: string; team_b?: string; teamA?: string; teamB?: string };
          const teamA = body.team_a ?? body.teamA;
          const teamB = body.team_b ?? body.teamB;
          if (!teamA || !teamB) {
            return Response.json({ error: "team_a and team_b are required" }, { status: 400 });
          }
          const bundle = predictMatch(teamA, teamB);
          return Response.json({
            team_a: bundle.teamA.name,
            team_b: bundle.teamB.name,
            prediction: bundle.original.win >= bundle.original.lose ? bundle.teamA.name : bundle.teamB.name,
            probabilities: {
              [bundle.teamA.name]: bundle.original.win,
              Draw: bundle.original.draw,
              [bundle.teamB.name]: bundle.original.lose,
            },
            simulation: {
              n: bundle.sim.n,
              [bundle.teamA.name]: bundle.sim.pWin,
              Draw: bundle.sim.pDraw,
              [bundle.teamB.name]: bundle.sim.pLose,
              expected_goals: bundle.xg,
            },
            model: "logistic_original_features",
            notebook_xgboost_holdout: WEIGHTS.notebookOriginal.groupStageHoldout.accuracy,
            disclaimer: "Historical academic reconstruction. Not a betting product.",
          });
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "We couldn't generate a prediction." },
            { status: 400 },
          );
        }
      },
    },
  },
});
