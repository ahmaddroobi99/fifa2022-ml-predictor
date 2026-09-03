import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Beaker,
  BookOpen,
  Database,
  FlaskConical,
  LayoutDashboard,
  Moon,
  Sun,
  Swords,
  Trophy,
} from "lucide-react";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/predict", label: "Predictor", icon: Swords },
  { to: "/lab", label: "Simulation lab", icon: FlaskConical },
  { to: "/tournament", label: "Tournament", icon: Trophy },
  { to: "/model", label: "Model", icon: Activity },
  { to: "/data", label: "Data", icon: Database },
  { to: "/methodology", label: "Methodology", icon: Beaker },
  { to: "/about", label: "About", icon: BookOpen },
];

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { mode, toggle } = useTheme();

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl tracking-tight">FIFA 2022</span>
            <span className="font-display text-xl tracking-tight text-accent">ML Lab</span>
          </Link>
          <div className="flex items-center gap-2">
            <p className="hidden text-[11px] uppercase tracking-[0.14em] text-muted sm:block">
              Historical · not betting
            </p>
            <button
              type="button"
              onClick={toggle}
              className="grid size-11 place-items-center rounded-[12px] hover:bg-elevated"
              aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <a
              href="https://github.com/ahmaddroobi99/fifa2022-ml-predictor"
              className="hidden h-11 items-center rounded-[12px] px-3 text-sm text-muted hover:text-fg sm:inline-flex"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              href="https://github.com/ahmaddroobi99/WordCup2022_WinnerPrediction_ML"
              className="hidden h-11 items-center rounded-[12px] px-3 text-sm text-muted hover:text-fg sm:inline-flex"
              target="_blank"
              rel="noreferrer"
            >
              Original 2022 repo
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        <nav
          aria-label="Primary"
          className="sticky top-[61px] hidden h-[calc(100dvh-61px)] w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line p-3 lg:flex"
        >
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-2.5 rounded-[14px] px-3 text-sm transition-colors",
                  active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <p className="mt-auto px-3 pb-3 text-[11px] leading-relaxed text-subtle">
            BSc reconstruction of a 2022 An-Najah ML course project. Retrospective, not a live tipster.
          </p>
        </nav>

        <main id="main" className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-[1400px] grid-cols-5">
          {NAV.slice(0, 5).map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] uppercase tracking-[0.08em]",
                    active ? "text-fg" : "text-muted",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label.split(" ")[0]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <ShellInner>{children}</ShellInner>
      </TooltipProvider>
    </ThemeProvider>
  );
}
