"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { cssTimeMs } from "@/lib/css-time";
import { routeTransition } from "@/lib/route-transition";

type Tops = { slide: number; nav: number; main: number };

/** The three parts that change position when the profile docks or undocks. */
function partsOf(shell: HTMLElement | null) {
  const slide = shell?.querySelector<HTMLElement>("[data-profile-slide]");
  const nav = shell?.querySelector<HTMLElement>(".dock-nav");
  const main = shell?.querySelector<HTMLElement>("main");
  return slide && nav && main ? { slide, nav, main } : null;
}

/** Width the browser's scrollbars take: 0 for overlay scrollbars (iOS, macOS default). */
function scrollbarWidth() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll";
  document.body.appendChild(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return width;
}

function topsOf(parts: NonNullable<ReturnType<typeof partsOf>>): Tops {
  return {
    slide: parts.slide.getBoundingClientRect().top,
    nav: parts.nav.getBoundingClientRect().top,
    main: parts.main.getBoundingClientRect().top,
  };
}

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

  // The tab asked for, until the route actually changes; then the committed
  // route is the truth again. Dropped on the segment change itself (not by
  // comparing against where the request started: that matched again after Back
  // and revived a stale request, leaving the page stuck in play).
  const [requested, setRequested] = useState<string | null>(null);
  const [seenSegment, setSeenSegment] = useState(segment);
  if (seenSegment !== segment) {
    setSeenSegment(segment);
    setRequested(null);
  }
  const label = requested ?? committed;
  const isPlay = label === "play";

  const ref = useRef<HTMLDivElement>(null);
  const segmentRef = useRef(segment);

  useLayoutEffect(() => {
    segmentRef.current = segment;
  }, [segment]);


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

  // The dock-up and dock-down are a FLIP: the layout changes to its final state
  // at once, and `transform` carries each moving part from where it *was* on
  // screen to where it now is. Animating the layout itself (a margin) re-flows
  // the whole page every frame on the main thread, and iOS Safari, which also has
  // no scroll anchoring, showed that as the content jumping; transforms run on
  // the compositor.
  //
  // "Where it was" is captured when the tab is clicked, before React re-renders
  // (the bus event is synchronous), so it includes anything already mid-flight.
  // The parts that move are the profile, the tabs, and the content under them.
  const before = useRef<{ toPlay: boolean; tops: Tops } | null>(null);
  const flights = useRef<Animation[]>([]);

  useEffect(
    () =>
      routeTransition.subscribe((event, to) => {
        const parts = partsOf(ref.current);
        if (parts) {
          before.current = {
            // Where this event leaves the mode: a cancel returns to the
            // committed route, anything else goes to the target tab.
            toPlay:
              event === "cancel" || !to
                ? segmentRef.current === "play"
                : to === "play",
            tops: topsOf(parts),
          };
        }

        // After the capture: this is what re-renders the page into its new mode,
        // and with flushSync that happens inside this call.
        if (event === "cancel" || !to) setRequested(null);
        else setRequested(to);
      }),
    [],
  );

  const wasPlay = useRef(isPlay);
  useLayoutEffect(() => {
    if (wasPlay.current === isPlay) return;
    wasPlay.current = isPlay;

    const snapshot = before.current;
    before.current = null;
    const shell = ref.current;
    const parts = partsOf(shell);
    // `data-animate` is the first-measure guard; before it, nothing is animated.
    // No snapshot means the change didn't come from a click (back/forward): it
    // just snaps.
    if (
      !shell ||
      !parts ||
      !snapshot ||
      snapshot.toPlay !== isPlay ||
      !shell.hasAttribute("data-animate") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // Stop anything still flying so the layout is measured as it really is.
    flights.current.forEach((flight) => flight.cancel());
    flights.current = [];

    let after = topsOf(parts);
    // Scrolled, the document just got shorter (entering) or taller (leaving), so
    // the content moved. Move the scroll position by the same amount to hold it
    // still; whatever can't be held (the top of the page is as far as it goes)
    // is left for the animation.
    const scrolled = window.scrollY;
    if (scrolled > 0) {
      window.scrollTo(0, Math.max(0, scrolled + after.main - snapshot.tops.main));
      after = topsOf(parts);
    }

    const duration = cssTimeMs("--mode-dur", 420);
    const easing =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--mode-ease")
        .trim() || "ease-out";

    flights.current = (Object.keys(parts) as (keyof Tops)[]).flatMap((key) => {
      const distance = snapshot.tops[key] - after[key];
      if (Math.abs(distance) < 1) return [];
      return [
        parts[key].animate(
          {
            transform: [`translateY(${distance}px)`, "translateY(0)"],
          },
          { duration, easing },
        ),
      ];
    });
  }, [isPlay]);
  // The colour change is a fixed sheet of the new colour fading in over the old
  // canvas, not the whole page's tokens easing (see "How the colour change is
  // drawn" in globals.css): opacity runs on the compositor, a document-wide
  // restyle every frame does not. `data-sheet` on <html> opts the page in; without
  // Web Animations it is never set and the CSS falls back to easing the tokens.
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetAnim = useRef<Animation | null>(null);
  const sheetWas = useRef(isPlay);

  useLayoutEffect(() => {
    // Not with classic scrollbars: the gutter they reserve can't be painted by
    // the sheet and shows the old canvas as a bar down the edge (see .play-sheet
    // in globals.css). Those browsers take the token fade, which includes it.
    if (typeof Element.prototype.animate !== "function" || scrollbarWidth() > 0)
      return;
    const root = document.documentElement;
    root.setAttribute("data-sheet", "");
    // Landing on /play: the sheet is already showing, so the canvas joins it.
    if (sheetWas.current) root.setAttribute("data-canvas", "play");
    return () => {
      root.removeAttribute("data-sheet");
      root.removeAttribute("data-canvas");
    };
  }, []);

  useLayoutEffect(() => {
    if (sheetWas.current === isPlay) return;
    sheetWas.current = isPlay;

    const root = document.documentElement;
    const sheet = sheetRef.current;
    if (!sheet || !root.hasAttribute("data-sheet")) return;

    // Leaving: the canvas goes back to dark first, so the sheet fades out over
    // it. Entering: it stays dark under the fade and joins the sheet at the end
    // (same colour, so the swap can't be seen).
    if (!isPlay) root.removeAttribute("data-canvas");

    // A switch in flight carries on from where its opacity is, not from a jump.
    const state = sheetAnim.current?.playState;
    const running = state === "running" || state === "paused";
    const from = running
      ? parseFloat(getComputedStyle(sheet).opacity)
      : isPlay
        ? 0
        : 1;
    sheetAnim.current?.cancel();
    sheetAnim.current = null;

    const duration = cssTimeMs("--tint-dur", 420);
    if (duration <= 0) {
      if (isPlay) root.setAttribute("data-canvas", "play");
      return;
    }
    const animation = sheet.animate(
      { opacity: [from, isPlay ? 1 : 0] },
      {
        duration,
        easing:
          getComputedStyle(root).getPropertyValue("--mode-ease").trim() ||
          "ease-out",
      },
    );
    sheetAnim.current = animation;
    animation.finished
      .then(() => {
        if (sheetAnim.current === animation && isPlay) {
          root.setAttribute("data-canvas", "play");
        }
      })
      // Cancelled by a switch the other way; that one owns the canvas now.
      .catch(() => {});
  }, [isPlay]);

  // What is slid out of view shouldn't stay reachable by keyboard or screen
  // reader: its links are behind the bar.
  useEffect(() => {
    const slide = ref.current?.querySelector<HTMLElement>(
      "[data-profile-slide]",
    );
    if (slide) slide.inert = isPlay;
  }, [isPlay]);

  // Browser chrome follows the page. The meta tag is only a hint at load, so it
  // is kept in step here; this also corrects a direct landing on /play, whose
  // server HTML carries the dark value. Values mirror --bg in globals.css, both
  // themes.
  //
  // Next replaces the whole block of head tags on every navigation, with fresh
  // ones carrying the server's value, a beat after this runs. So a one-off write
  // loses; keep it applied for as long as this mode lasts.
  useEffect(() => {
    const color = isPlay ? "rgb(0, 100, 230)" : "#0a0a0b";
    const apply = () => {
      document
        .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
        .forEach((meta) => {
          if (meta.content !== color) meta.content = color;
        });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [isPlay]);

  return (
    <div
      ref={ref}
      className="shell pb-14 sm:pb-20"
      data-mode={isPlay ? "play" : undefined}
      data-page={segment === "play" ? "play" : undefined}
    >
      <div ref={sheetRef} className="play-sheet" aria-hidden="true" />
      {children}
    </div>
  );
}
