import { createFileRoute } from "@tanstack/react-router";
import { TEAMS } from "@/lib/ml/engine";

export const Route = createFileRoute("/api/teams")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          teams: TEAMS.map((t) => ({
            name: t.name,
            code: t.code,
            group: t.group,
            fifaRank: t.fifaRank,
            elo: t.elo,
            squadOverall: t.squadOverall,
          })),
        }),
    },
  },
});
