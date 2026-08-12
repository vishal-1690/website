import LogoMark from "./LogoMark";
import { formatRange, type Experience } from "@/content/site";

/**
 * One experience entry. The date range appears twice in the markup — inline on
 * mobile, right-aligned on desktop — but only ever one is displayed, so screen
 * readers encounter it once.
 */
export default function WorkRow({ item }: { item: Experience }) {
  const range = formatRange(item.start, item.end);

  return (
    <article className="work-row grid grid-cols-1 items-start gap-y-3 py-5 sm:grid-cols-[78px_1fr_auto] sm:gap-x-5 sm:gap-y-0">
      <LogoMark company={item.company} logo={item.logo} size={78} />

      <div className="min-w-0 sm:col-start-2">
        <h3 className="text-base leading-snug font-medium text-foreground">
          {item.role}
          <span className="text-muted"> at </span>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline"
            >
              {item.company}
            </a>
          ) : (
            item.company
          )}
        </h3>

        <span className="row-date mt-1 block text-2xs text-faint tabular-nums sm:hidden">
          {range}
        </span>

        <p className="mt-2 text-sm leading-[1.6] text-muted">
          {item.description}
        </p>
      </div>

      <span className="row-date hidden text-2xs whitespace-nowrap text-faint tabular-nums sm:col-start-3 sm:block sm:pt-0.5">
        {range}
      </span>
    </article>
  );
}
