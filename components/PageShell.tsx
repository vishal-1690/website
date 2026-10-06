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

  // Entering play while scrolled. The dock turns sticky and pins to the top of
  // the viewport at its full, un-collapsed height, so the whole profile would
  // appear there and then slide away: the slide would start from the top of the
  // page rather than from where the visitor is. Instead, start the margin from
  // where the profile *is*: scrolled out by `scrollY`, capped at its height. If
  // it was fully off-screen the bar starts with no gutter and the gutter grows
  // to the peek; if it was partly visible, what's visible slides up from there.
  // The document gets shorter by the same amount, so the scroll position is
  // reduced to keep the content under the bar where it was.
  const wasPlay = useRef(isPlay);
  useLayoutEffect(() => {
    const entering = isPlay && !wasPlay.current;
    wasPlay.current = isPlay;
    if (!entering) return;

    const shell = ref.current;
    const slide = shell?.querySelector<HTMLElement>("[data-profile-slide]");
    const scrolled = window.scrollY;
    // `data-animate` is the first-measure guard; before it, nothing is animated.
    if (!shell || !slide || scrolled <= 0 || !shell.hasAttribute("data-animate"))
      return;

    const hidden = Math.min(scrolled, slide.offsetHeight);
    slide.style.transition = "none";
    slide.style.marginTop = `${-hidden}px`;
    // Settle that start value (a computed style the transition can run from)
    // before the margin is released toward its docked value.
    void slide.offsetHeight;
    window.scrollTo(0, scrolled - hidden);

    const frame = requestAnimationFrame(() => {
      slide.style.removeProperty("transition");
      slide.style.removeProperty("margin-top");
    });
    return () => {
      cancelAnimationFrame(frame);
      slide.style.removeProperty("transition");
      slide.style.removeProperty("margin-top");
    };
  }, [isPlay]);

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
