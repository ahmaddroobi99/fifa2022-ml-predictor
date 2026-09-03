import * as React from "react";

type Mode = "dark" | "light";

const ThemeContext = React.createContext<{
  mode: Mode;
  toggle: () => void;
}>({ mode: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<Mode>("dark");

  React.useEffect(() => {
    const stored = window.localStorage.getItem("fifa-ml-theme") as Mode | null;
    const next = stored === "light" || stored === "dark" ? stored : "dark";
    setMode(next);
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  const toggle = React.useCallback(() => {
    setMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      window.localStorage.setItem("fifa-ml-theme", next);
      document.documentElement.classList.toggle("light", next === "light");
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ mode, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
