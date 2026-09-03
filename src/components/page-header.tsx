export function PageHeader({
  kicker,
  title,
  lede,
}: {
  kicker: string;
  title: string;
  lede: string;
}) {
  return (
    <header className="mb-8 max-w-3xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{kicker}</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-3 text-pretty text-muted">{lede}</p>
    </header>
  );
}
