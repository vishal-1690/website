import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Play",
};

// Stand-ins for the spread layout (`.play-grid` / `.play-cell` in globals.css).
// Not rendered for now; bring back by rendering <PlaceholderGrid />.
const SHEETS = ["01", "02", "03", "04", "05", "06"];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PlaceholderGrid() {
  return (
    <ul className="play-grid">
      {SHEETS.map((n) => (
        <li key={n} className="play-cell">
          <span className="text-2xs uppercase tracking-[0.14em] text-faint">
            Fig. {n}
          </span>
          <span className="text-2xs text-muted">Placeholder</span>
        </li>
      ))}
    </ul>
  );
}

export default function PlayPage() {
  return (
    <section className="play-page flex flex-col gap-6 py-8">
      {/* The page spreads, but the words stay in the reading column, aligned
          with the tabs above and with the other pages. */}
      <div className="play-col flex flex-col items-start gap-2">
        <h2 className="text-base font-medium text-foreground">Play</h2>
        <p className="max-w-[42ch] text-sm leading-[1.6] text-muted">
          Experiments, interface studies, and things built to figure out how they
          work. Coming soon.
        </p>
      </div>
    </section>
  );
}
