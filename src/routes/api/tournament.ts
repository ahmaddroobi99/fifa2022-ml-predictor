import { createFileRoute } from "@tanstack/react-router";
import { TOURNAMENT } from "@/lib/ml/engine";

export const Route = createFileRoute("/api/tournament")({
  server: {
    handlers: {
      GET: async () => Response.json(TOURNAMENT),
    },
  },
});
