"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

const TABS = [
  { segment: null, href: "/", label: "work" },
  { segment: "about", href: "/about", label: "about" },
  { segment: "play", href: "/play", label: "play" },
] as const;

/**
 * Reads the active segment rather than taking it as a prop, so it can live in
 * layout.tsx (outside template.tsx) and survive navigation instead of
 * remounting.
 */
export default function SegmentedNav() {
  const segment = useSelectedLayoutSegment();
  const activeLabel =
    (TABS.find((tab) => tab.segment === segment) ?? TABS[0]).label;

  return (
    <nav className="nav-well flex w-full p-1 sm:inline-flex sm:w-auto">
      {TABS.map((tab) => {
        const isActive = tab.label === activeLabel;
        return (
          <Link
            key={tab.label}
            href={tab.href}
            // The header is persistent chrome, so scrolling to top on every tab
            // change would make a same-page swap feel like a full page load.
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`nav-tab flex-1 px-4 py-2.5 text-center text-xs text-foreground sm:flex-none sm:py-1.5 ${
              isActive ? "nav-tab-active font-medium" : ""
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
