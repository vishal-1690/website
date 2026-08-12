import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex flex-col items-start gap-4">
      <h1 className="text-xl font-medium tracking-tight text-foreground">404</h1>
      <p className="text-base text-muted">That page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="link-underline text-xs text-muted hover:text-foreground"
      >
        ← back to work
      </Link>
    </section>
  );
}
