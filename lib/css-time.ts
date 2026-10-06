/**
 * A CSS time custom property, in milliseconds.
 *
 * The build minifies `420ms` to `.42s`, so reading `--mode-dur` back from the
 * stylesheet can give either unit; parsing it as a bare number is wrong half the
 * time.
 */
export function cssTimeMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  return raw.endsWith("ms") ? value : raw.endsWith("s") ? value * 1000 : fallback;
}
