"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { waapi, type WAAPIAnimation } from "animejs";
import { blast } from "@/lib/play-blast";
import { routeTransition } from "@/lib/route-transition";

const TABS = [
  { segment: null, href: "/", label: "work" },
  { segment: "about", href: "/about", label: "about" },
  { segment: "play", href: "/play", label: "play" },
] as const;

// Same duration and curve as the content's pop in app/template.tsx (ENTER), so
// the chip and the page land together. Change them as a pair.
const SLIDE = { duration: 260, ease: "cubic-bezier(0.32, 0.72, 0, 1)" };

/**
 * Reads the active segment rather than taking it as a prop, so it can live in
 * layout.tsx (outside template.tsx) and survive navigation instead of
 * remounting.
 *
 * The active chip is a single element that slides between tabs, rather than a
 * background each tab paints for itself. It follows the *clicked* tab at once
 * instead of waiting for the route to commit, so the nav answers the click even
 * when the page behind it is slow.
 */
export default function SegmentedNav() {
  const segment = useSelectedLayoutSegment();
  const committed =
    (TABS.find((tab) => tab.segment === segment) ?? TABS[0]).label;

  // The tab the user just asked for, until the route actually changes. It is
  // dropped the moment the committed segment changes (reset during render, the
  // supported way to derive state from a changed value), so it can never outlive
  // the navigation it was for. An earlier version left it in place and kept it
  // "valid while the route it was asked from is committed", which is true again
  // after Back: the stale request came back to life and held the old tab.
  const [requested, setRequested] = useState<string | null>(null);
  const [seenSegment, setSeenSegment] = useState(segment);
  if (seenSegment !== segment) {
    setSeenSegment(segment);
    setRequested(null);
  }
  const shown = requested ?? committed;

  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const shownRef = useRef(shown);
  const slide = useRef<WAAPIAnimation | null>(null);
  const placed = useRef(false);

  const measure = (label: string) => {
    const link = links.current.get(label);
    return link ? { x: link.offsetLeft, w: link.offsetWidth } : null;
  };

  const place = (rect: { x: number; w: number }) => {
    const pill = pillRef.current;
    if (!pill) return;
    pill.style.transform = `translateX(${rect.x}px)`;
    pill.style.width = `${rect.w}px`;
  };

  useLayoutEffect(() => {
    shownRef.current = shown;
    const pill = pillRef.current;
    const rect = measure(shown);
    if (!pill || !rect) return;

    if (!placed.current) {
      // First paint: put the chip under the right tab with no travel, then let
      // CSS swap the server-rendered per-tab background for it.
      placed.current = true;
      place(rect);
      navRef.current?.setAttribute("data-ready", "");
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Only `transform` and `width` change, and `waapi` hands them to the browser
    // as one Web Animation. Retargeting mid-slide starts from where the chip is.
    slide.current = waapi.animate(pill, {
      transform: `translateX(${rect.x}px)`,
      width: rect.w,
      duration: reduced.matches ? 0 : SLIDE.duration,
      ease: SLIDE.ease,
    });
  }, [shown]);

  // Tab widths change with the viewport (the root font size is fluid) and when
  // the web font lands, which would leave the chip stranded. Re-seat it without
  // animating, and stop any slide that is about to write a stale width.
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      const rect = measure(shownRef.current);
      if (!rect || !placed.current) return;
      slide.current?.cancel();
      place(rect);
    });
    links.current.forEach((link) => observer.observe(link));
    return () => observer.disconnect();
  }, []);

  // Back and forward change the route with no click, so nothing above would
  // know a switch had started: the page would restyle and the chip would move
  // only once the new route committed, and the outgoing content wouldn't ghost.
  // Treat the new URL as the tab that was asked for, exactly as a click does.
  // `popstate` fires before Next has rendered the new route, so the page is
  // still as the visitor left it when the listeners (PageShell's snapshot) read it.
  const committedRef = useRef(committed);
  useLayoutEffect(() => {
    committedRef.current = committed;
  }, [committed]);

  useEffect(() => {
    const onPop = () => {
      const path = location.pathname.replace(/\/$/, "") || "/";
      const tab = TABS.find((t) => t.href === path);
      if (!tab) return;
      setRequested(tab.label);
      routeTransition.emit(
        tab.label === committedRef.current ? "cancel" : "leave",
        tab.label,
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const onTabClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    label: string,
  ) => {
    // Modified clicks open a new tab or window; this page isn't going anywhere.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const apply = () => {
      setRequested(label);
      // Going back to the tab we're on abandons any switch in flight; anything
      // else starts one. Navigation itself is left to <Link>.
      routeTransition.emit(label === committed ? "cancel" : "leave", label);
    };

    // Entering play blooms from the click. The change is applied inside the
    // transition (flushSync, so it lands before the browser's "after" picture);
    // where that isn't available this falls through to the plain colour fade.
    if (label === "play" && committed !== "play") {
      const rect = event.currentTarget.getBoundingClientRect();
      // Keyboard activation reports a click at 0,0; bloom from the tab instead.
      const origin =
        event.detail === 0
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: event.clientX, y: event.clientY };
      if (blast(origin, () => flushSync(apply))) return;
    }
    apply();
  };

  return (
    <nav
      ref={navRef}
      className="nav-well relative flex w-full p-1 sm:inline-flex sm:w-auto"
    >
      <span ref={pillRef} className="nav-pill" aria-hidden="true" />
      {TABS.map((tab) => {
        const isShown = tab.label === shown;
        return (
          <Link
            key={tab.label}
            ref={(node) => {
              if (node) links.current.set(tab.label, node);
              else links.current.delete(tab.label);
            }}
            href={tab.href}
            // The header is persistent chrome, so scrolling to top on every tab
            // change would make a same-page swap feel like a full page load.
            scroll={false}
            onClick={(event) => onTabClick(event, tab.label)}
            aria-current={tab.label === committed ? "page" : undefined}
            data-label={tab.label}
            className={`nav-tab flex-1 px-4 py-2.5 text-center text-xs text-foreground sm:flex-none sm:py-1.5 ${
              isShown ? "nav-tab-active font-medium" : ""
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
