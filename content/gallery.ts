/**
 * Image galleries for work rows, keyed by the slug in `Experience.gallery`.
 *
 * PLACEHOLDER: these resolve to placecats.com so the interaction can be built
 * before the real screenshots exist. When the media pipeline lands
 * (docs/work-image-stack-carousel.md §3) this file is replaced by a lookup into
 * the generated manifest, and `thumbSrc` / `src` become the real thumb and
 * full-size variants. Callers only depend on the `GalleryImage` shape.
 */

export interface GalleryImage {
  id: string;
  alt: string;
  /** Natural size of the full image. Only the aspect ratio matters for layout. */
  width: number;
  height: number;
  /** Static, small. What the pile shows and what the carousel opens with. */
  thumbSrc: string;
  /** Full-size, possibly animated. Unused until the crossfade step. */
  src: string;
}

/** Where a pile card sits in the viewport, measured from the live DOM. */
export interface PilePose {
  /** Centre in viewport px. Rotation and scale both pivot on it. */
  cx: number;
  cy: number;
  /** Rendered width in px, scale included. */
  width: number;
  /** Degrees. */
  rotate: number;
  /** Stacking order in the pile; the overlay copies it so z-order matches in flight. */
  z: number;
}

const cat = (id: string, width: number, height: number, alt: string): GalleryImage => {
  const url = `https://placecats.com/${width}/${height}`;
  return { id, alt, width, height, thumbSrc: url, src: url };
};

const galleries: Record<string, GalleryImage[]> = {
  // A deliberately awkward mix: landscape, tall phone, square, panoramic, portrait.
  flipai: [
    cat("wide", 1200, 750, "Placeholder cat, landscape"),
    cat("phone", 640, 1136, "Placeholder cat, tall phone screenshot"),
    cat("square", 1000, 1000, "Placeholder cat, square"),
    cat("panorama", 1440, 640, "Placeholder cat, panoramic"),
    cat("portrait", 900, 1200, "Placeholder cat, portrait"),
  ],
};

export function getGallery(slug: string): GalleryImage[] {
  return galleries[slug] ?? [];
}
