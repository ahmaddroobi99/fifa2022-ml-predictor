import { createFileRoute } from "@tanstack/react-router";
import { EXPERIMENTS, WEIGHTS } from "@/lib/ml/engine";

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          notebook: WEIGHTS.notebookOriginal,
          reconstruction: WEIGHTS.original.metrics,
          enhanced: WEIGHTS.enhanced.metrics,
          walkForward: EXPERIMENTS.walkForward,
        }),
    },
  },
});
