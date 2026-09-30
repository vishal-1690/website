import LogoMark from "./LogoMark";
import WorkGallery from "./WorkGallery";
import { getGallery } from "@/content/gallery";
import { formatRange, type Experience } from "@/content/site";

/**
 * One experience entry. The date range appears twice in the markup — inline on
 * mobile, right-aligned on desktop — but only ever one is displayed, so screen
 * readers encounter it once.
 */
export default function WorkRow({ item }: { item: Experience }) {
  const range = formatRange(item.start, item.end);
  const images = item.gallery ? getGallery(item.gallery) : [];

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

      {/* One column-3 wrapper so the pile sits directly under the date rather
          than under the (taller) description. On mobile it drops below the
          description, left aligned. */}
      <div className="flex flex-col items-end gap-3 sm:col-start-3 sm:self-stretch sm:justify-between">
        <span className="row-date hidden text-2xs whitespace-nowrap text-faint tabular-nums sm:block sm:pt-0.5">
          {range}
        </span>
        {images.length > 0 && (
          <WorkGallery
            images={images}
            label={`View ${images.length} screenshots from ${item.company}`}
            caption={`${images.length} screenshots`}
          />
        )}
      </div>
    </article>
  );
}
