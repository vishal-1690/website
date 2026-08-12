/**
 * Squircle initials placeholder shown when `profile.avatar` is null, so the
 * site looks intentional before any image exists.
 *
 * Rendered as a div rather than an SVG so it can use the `.squircle` corner
 * treatment, which SVG shapes cannot.
 */
export default function Monogram({
  initials,
  size = 72,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <div
      role="img"
      aria-label={`${initials} monogram`}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      className="squircle flex shrink-0 items-center justify-center border-2 border-border-tile bg-surface tracking-wide text-muted"
    >
      {initials.toUpperCase()}
    </div>
  );
}
