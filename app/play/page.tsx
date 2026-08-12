import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Play",
};

export default function PlayPage() {
  return (
    <section className="flex flex-col items-start gap-3 py-8">
      <h2 className="text-base font-medium text-foreground">Play</h2>
      <p className="max-w-[42ch] text-sm leading-[1.6] text-muted">
        Experiments, interface studies, and things built to figure out how they
        work. Coming soon.
      </p>
    </section>
  );
}
