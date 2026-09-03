import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"span"> & { tone?: "default" | "win" | "loss" | "muted" | "accent" }) {
  const tones = {
    default: "bg-elevated text-fg",
    win: "bg-win/15 text-win",
    loss: "bg-loss/15 text-loss",
    muted: "bg-elevated text-muted",
    accent: "bg-accent/15 text-accent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
