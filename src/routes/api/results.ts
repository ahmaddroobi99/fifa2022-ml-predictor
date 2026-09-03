import { createFileRoute } from "@tanstack/react-router";
import { ORIGINAL, TOURNAMENT } from "@/lib/ml/engine";

export const Route = createFileRoute("/api/results")({
  server: {
    handlers: {
      GET: async () => Response.json({ original: ORIGINAL, tournament: TOURNAMENT }),
    },
  },
});
