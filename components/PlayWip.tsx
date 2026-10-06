"use client";

import { useLayoutEffect, useRef } from "react";
import { createTimeline, svg } from "animejs";
import { WIP_STROKES, WIP_VIEWBOX } from "./play-wip-strokes";

/**
 * A temporary "WIP!" for the play page, written on screen stroke by stroke.
 *
 * The letters are the owner's trace of Reenie Beanie: each stroke is a filled pen
 * outline (kept exactly as traced, so the thick and thin of the pen survive). A
 * filled outline can't be drawn on directly, so each one is shown through a mask,
 * and what Anime's `createDrawable` draws is a thick *centre line* inside that
 * mask: the outline appears as the pen would lay it down. The centre lines are
 * derived from each outline's two edges (see play-wip-strokes.ts), in the order
 * the strokes were traced.
 *
 * Delete this, play-wip-strokes.ts, and its use in app/play/page.tsx when there
 * is real work to show.
 */

/** Wait this long after mounting: the page is still docking for ~420ms. */
const START_DELAY_MS = 380;

/** How much faster than the traced pace the pen writes (durations and gaps). */
const SPEED = 3;

export default function PlayWip() {
  const root = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveals = Array.from(
      el.querySelectorAll<SVGPathElement>("[data-reveal]"),
    );

    // Hidden until the strokes are set to "nothing revealed yet", so the finished
    // word from the server HTML never flashes before it starts.
    const drawables = reveals.map(
      (path) => svg.createDrawable(path, 0, reduced ? 1 : 0)[0],
    );
    el.setAttribute("data-ready", "");
    if (reduced) return;

    const timeline = createTimeline({ delay: START_DELAY_MS });
    let at = 0;
    WIP_STROKES.forEach((stroke, i) => {
      const duration = stroke.ms / SPEED;
      timeline.add(
        drawables[i],
        { draw: "0 1", duration, ease: "inOutSine" },
        at,
      );
      at += duration + stroke.gap / SPEED;
    });

    return () => {
      timeline.revert();
    };
  }, []);

  // The tilt is a CSS rotation on the wrapper (`.play-wip`), not on the <svg>, so
  // nothing Anime writes to the <svg> can replace it.
  return (
    <div className="play-wip">
      <svg
        ref={root}
        viewBox={WIP_VIEWBOX}
        role="img"
        aria-label="Work in progress"
        fill="currentColor"
        stroke="none"
      >
        {WIP_STROKES.map((stroke) => (
          // The group carries the stroke's own offset, so the outline and its
          // mask share one set of coordinates.
          <g key={stroke.id} transform={`translate(${stroke.tx} ${stroke.ty})`}>
            <mask id={`wip-mask-${stroke.id}`}>
              <path
                data-reveal=""
                d={stroke.c}
                fill="none"
                stroke="#fff"
                strokeWidth={stroke.w}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </mask>
            <path d={stroke.d} mask={`url(#wip-mask-${stroke.id})`} />
          </g>
        ))}
      </svg>
    </div>
  );
}
