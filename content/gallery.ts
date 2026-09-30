/**
 * Image galleries for work rows, keyed by the slug in `Experience.gallery`.
 *
 * The data is generated from media/work/<slug>/ by
 * scripts/build-work-media.mjs (runs on predev/prebuild); see
 * docs/work-image-stack-carousel.md.
 */

import manifest from "./work-media.generated.json";

export interface GalleryImage {
  id: string;
  alt: string;
  /** "video" plays in the carousel; "image" may still be an animated image. */
  kind: "image" | "video";
  /** Video or animated image. Only the active slide ever plays. */
  animated: boolean;
  /** Natural size of the full asset. Only the aspect ratio matters for layout. */
  width: number;
  height: number;
  /** Static first frame, small. The pile shows it and the slide starts on it. */
  thumbSrc: string;
  /** The full asset: video file, animated image, or large still. */
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
  /** False for cards tucked out of sight beneath the visible pile. */
  visible: boolean;
}

const galleries = manifest as Record<string, GalleryImage[]>;

export function getGallery(slug: string): GalleryImage[] {
  return galleries[slug] ?? [];
}
