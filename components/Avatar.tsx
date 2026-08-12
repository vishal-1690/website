import Image from "next/image";
import Monogram from "./Monogram";

/**
 * Renders a real photo when `src` is set, otherwise the monogram placeholder.
 * Swapping in a photo = drop the file in /public and set `profile.avatar`.
 */
export default function Avatar({
  src,
  name,
  initials,
  size = 96,
}: {
  src: string | null;
  name: string;
  initials: string;
  size?: number;
}) {
  if (!src) {
    return <Monogram initials={initials} size={size} />;
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="squircle sticker shrink-0 overflow-hidden border-2 border-border-tile"
    >
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        sizes="(max-width: 768px) 132px, 144px"
        preload
      />
    </div>
  );
}
