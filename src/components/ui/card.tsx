import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[28px] bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("font-display text-xl font-semibold tracking-tight text-fg", className)}
      {...props}
    />
  );
}

export function CardKicker({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted", className)}
      {...props}
    />
  );
}
