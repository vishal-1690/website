import Image from "next/image";

/**
 * Squircle company logo with a thick border. Falls back to a flat tile with the
 * company's initial when `logo` is null.
 *
 * The image sits in a wrapper rather than being styled directly, because
 * `corner-shape` needs a plain element to clip — it does not apply to the
 * <img> that next/image renders.
 */
export default function LogoMark({
  company,
  logo,
  size = 44,
}: {
  company: string;
  logo: string | null;
  size?: number;
}) {
  if (logo) {
    return (
      <div
        style={{ width: size, height: size }}
        className="logo-tile squircle sticker shrink-0 overflow-hidden border-2 border-border-tile"
      >
        <Image src={logo} alt={`${company} logo`} width={size} height={size} />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="logo-tile squircle flex shrink-0 items-center justify-center border-2 border-border-tile bg-surface text-base text-muted"
    >
      {company.charAt(0).toUpperCase()}
    </div>
  );
}
