import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, service: "fifa2022-ml-lab", cutoff: "2022-06-14" }),
    },
  },
});
