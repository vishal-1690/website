"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { routeTransition } from "@/lib/route-transition";

/**
 * Owns the two attributes the play state is styled from (see globals.css,
 * "Play state"):
 *
 *  - `data-mode="play"` follows the tab the user *asked for*, at click time, so
 *    the whole page starts changing the moment the chip moves, even if the route
 *    behind it is slow. Same requested-vs-committed rule as SegmentedNav.
 *  - `data-page="play"` follows the *committed* route. It drives the content
 *    width, which must not change while the old page is still ghosted on screen
 *    (the text would re-wrap); it snaps under the incoming page's pop instead.
 *
 * It is a client component only for those two attributes and to measure the
 * profile block. Both children are still server-rendered, and the attributes are
 * correct in the server HTML for a direct load of /play.
 */
export default function PageShell({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const committed = segment === "play" ? "play" : segment ?? "work";

  const [requested, setRequested] = useState<{
    label: string;
    from: string | null;
  } | null>(null);
  const label =
    requested && requested.from === segment ? requested.label : committed;
  const isPlay = label === "play";

  const ref = useRef<HTMLDivElement>(null);
  const segmentRef = useRef(segment);

  useLayoutEffect(() => {
    segmentRef.current = segment;
  }, [segment]);

  useEffect(
    () =>
      routeTransition.subscribe((event, to) => {
        if (event === "cancel" || !to) setRequested(null);
        else setRequested({ label: to, from: segmentRef.current });
      }),
    [],
  );

  // The profile slides up by (its height − the peek), and CSS can't read an
  // element's height into a margin it can transition, so it is measured here.
  // The slide transition stays off until after this first measure, so landing
  // directly on /play doesn't play the dock-up on load.
  useLayoutEffect(() => {
    const shell = ref.current;
    const slide = shell?.querySelector<HTMLElement>("[data-profile-slide]");
    if (!shell || !slide) return;

    const measure = () =>
      shell.style.setProperty("--profile-h", `${slide.offsetHeight}px`);
    measure();
    // Hands the docked layout from the CSS pre-measure fallback to the margin.
    shell.setAttribute("data-measured", "");
    const observer = new ResizeObserver(measure);
    observer.observe(slide);
    const frame = requestAnimationFrame(() =>
      shell.setAttribute("data-animate", ""),
    );
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // What is slid out of view shouldn't stay reachable by keyboard or screen
  // reader: its links are behind the bar.
  useEffect(() => {
    const slide = ref.current?.querySelector<HTMLElement>(
      "[data-profile-slide]",
    );
    if (slide) slide.inert = isPlay;
  }, [isPlay]);

  return (
    <div
      ref={ref}
      className="shell pb-14 sm:pb-20"
      data-mode={isPlay ? "play" : undefined}
      data-page={segment === "play" ? "play" : undefined}
    >
      {children}
    </div>
  );
}
