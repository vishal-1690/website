"use client";

import { useEffect, useId, useRef, useState } from "react";
import { site } from "@/content/site";

/**
 * Thought bubble that follows the profile picture. Wraps the avatar so it can
 * catch hover and click on it.
 *
 * Three trailing circles plus the body share an SVG goo filter (see the filter
 * below and `.goo-layer` in globals.css). The filter blurs their alpha into one
 * mass, then thresholds it back to a hard edge, so the shapes read as one
 * liquid body. The label sits outside the filtered layer, because thresholding
 * alpha chews up antialiased text.
 *
 * Entry runs as a sequence, smallest circle first: 3 -> 2 -> 1 -> body inflates
 * -> text fades in. Dismissing plays the same sequence in reverse.
 *
 * It only closes on an explicit dismiss via the X. Moving the cursor away
 * deliberately does nothing, so it never vanishes from under you while you
 * are reading it.
 */

/** Matches the longest exit delay + duration in globals.css. */
const EXIT_MS = 840;
/** How long the pointer must remain over the avatar before the bubble opens. */
const HOVER_DELAY_MS = 300;
/** Where the bubble settles once the avatar is gone, in viewport px. */
const PARKED = { top: 24, left: 24 };
/** Per-frame easing toward the target. Lower = laggier, springier follow. */
const FOLLOW = 0.14;

type Phase = "idle" | "in" | "out";

export default function HireBubble({
  children,
}: {
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const wrapRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { profile } = site;
  // Desktop and mobile each render an instance, so the filter id must be
  // unique — duplicate ids would make one instance reference the other's.
  const filterId = `goo-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    // Late enough that the page has settled, so the motion reads as a thought
    // arriving rather than part of the initial paint.
    const t = setTimeout(() => setPhase("in"), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );

  /**
   * The bubble is `fixed` and its position is driven here rather than by CSS.
   *
   * `sticky` cannot do this job: it is confined to its containing block, and
   * the wrapper is only as tall as the avatar, so it would unstick almost
   * immediately. Instead each frame reads where the avatar actually is, eases
   * the bubble toward the spot just above it, and clamps to the top-left of
   * the viewport once the avatar has scrolled away — so the bubble slides
   * smoothly into place instead of snapping between two states.
   *
   * The tail rotates to keep pointing back at the avatar, so when the avatar
   * is below the viewport the circles swing round and trail downward.
   *
   * The loop stops once nothing is left to interpolate, and scroll or resize
   * wakes it again — it does not run a frame callback while the page is still.
   */
  useEffect(() => {
    const wrap = wrapRef.current;
    const root = rootRef.current;
    if (!wrap || !root) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let raf = 0;
    let x: number | null = null;
    let y: number | null = null;
    let angle: number | null = null;

    const tick = () => {
      const a = wrap.getBoundingClientRect();

      /* Desktop and mobile each render an instance, and the one for the other
         breakpoint sits inside a `display: none` parent — every measurement
         comes back zero. Bail out before the maths runs on garbage, and keep
         the loop alive so this instance starts tracking the moment its
         breakpoint becomes the active one. Without this the hidden instance
         settled at the parked position with a stale offsetHeight of 0, and
         stayed frozen there after a breakpoint change. */
      if (a.width === 0 && a.height === 0) {
        root.style.visibility = "hidden";
        // Stop rather than spin — the ResizeObserver below wakes this instance
        // when its breakpoint makes the avatar visible again.
        raf = 0;
        return;
      }
      root.style.visibility = "";

      // Where the bubble wants to sit: just above the avatar's top-right,
      // clamped so it never leaves the viewport.
      const width = root.offsetWidth || 160;
      const rawX = a.left + a.width * 0.6;
      const rawY = a.top - root.offsetHeight - 12;

      const maxX = window.innerWidth - width - 16;
      const targetX = Math.min(Math.max(rawX, PARKED.left), Math.max(maxX, 16));
      const targetY = Math.max(rawY, PARKED.top);

      const cx = a.left + a.width / 2;
      const cy = a.top + a.height / 2;

      /* The tail attaches somewhere on the body's rounded left end rather than
         at a fixed corner: as the avatar moves from below to above, the joint
         slides bottom-left -> left -> top-left so the tail never detaches from
         the edge.

         The left end is a semicircle of radius = half the body height, so the
         joint is a point on that arc at the bearing of the avatar, limited to
         the diagonals — 135deg (bottom-left corner) through 180deg (left) to
         225deg (top-left corner). Letting it reach straight up or down put the
         joint under the body where the tail read as sprouting from nowhere. */
      const h = root.offsetHeight;
      const r = h / 2;
      const capX = targetX + r;
      const capY = targetY + r;

      const bearing = Math.atan2(cy - capY, cx - capX);
      const norm = ((bearing % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const clamped = Math.max(
        (3 * Math.PI) / 4,
        Math.min((5 * Math.PI) / 4, norm),
      );

      const jointX = capX + Math.cos(clamped) * r;
      const jointY = capY + Math.sin(clamped) * r;

      /* The tail must always trail AWAY from the body, so its direction is the
         joint's own outward normal — the same bearing that placed the joint on
         the arc. Deriving the rotation from the avatar independently let the
         two disagree: with the joint at the top-left and the rotation clamped
         at -45deg, the circles swung inward across the pill.

         The drops hang downward in the tail's local frame, which is the 90deg
         direction, so the rotation is the normal minus 90. */
      const targetAngle = (clamped * 180) / Math.PI - 90;

      if (x === null || y === null || angle === null || reduce) {
        x = targetX;
        y = targetY;
        angle = targetAngle;
      } else {
        x += (targetX - x) * FOLLOW;
        y += (targetY - y) * FOLLOW;
        angle += (targetAngle - angle) * FOLLOW;
      }

      root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      root.style.setProperty("--tail-angle", `${angle}deg`);
      // Joint expressed relative to the root, so the tail pivots from the
      // point where it actually meets the body's rounded edge.
      root.style.setProperty("--joint-x", `${jointX - targetX}px`);
      root.style.setProperty("--joint-y", `${jointY - targetY}px`);

      // Once everything has settled there is nothing left to interpolate, so
      // stop the loop rather than burning a frame callback forever. Scroll and
      // resize wake it back up.
      const settled =
        Math.abs(targetX - x) < 0.1 &&
        Math.abs(targetY - y) < 0.1 &&
        Math.abs(targetAngle - angle) < 0.1;

      if (settled) {
        // Snap off the sub-pixel remainder so it rests on exact values.
        x = targetX;
        y = targetY;
        angle = targetAngle;
        raf = 0;
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);

    /* A media-query breakpoint flips which instance is visible without firing
       scroll, and on a phone `resize` may never fire at all. Watching the
       wrapper's own box catches the transition from 0x0 to real dimensions. */
    const ro = new ResizeObserver(wake);
    ro.observe(wrap);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
    };
  }, []);

  function show() {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    // Cancel a pending unmount so re-entry mid-exit picks straight back up.
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    setPhase("in");
  }

  function scheduleShow() {
    if (phase === "in" || hoverTimer.current) return;

    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null;
      show();
    }, HOVER_DELAY_MS);
  }

  function cancelScheduledShow() {
    if (!hoverTimer.current) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }

  /** Only ever called explicitly via the X. */
  function hide() {
    setPhase("out");
    exitTimer.current = setTimeout(() => setPhase("idle"), EXIT_MS);
  }

  if (!profile.available) return <>{children}</>;

  return (
    <div
      ref={wrapRef}
      className="avatar-wrap"
      onMouseEnter={scheduleShow}
      onMouseLeave={cancelScheduledShow}
    >
      {children}

      <div
        ref={rootRef}
        className="hire-root"
        data-phase={phase}
        aria-hidden={phase !== "in"}
      >
        <svg aria-hidden="true" className="hire-defs" focusable="false">
          <defs>
            {/* Blur merges neighbouring alpha; the matrix multiplies it by 20
                and subtracts 9, snapping the gradient back to a hard edge. That
                threshold makes separate shapes read as one liquid body. */}
            {/* An explicit, generous filter region. The default is -10%/120%,
                which clips the tail — it hangs well outside the body's box —
                and Safari is stricter about it than Chrome.
                `filterUnits` is objectBoundingBox, so these are fractions. */}
            <filter
              id={filterId}
              x="-75%"
              y="-75%"
              width="250%"
              height="250%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="6"
                result="blur"
              />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
                result="goo"
              />
              <feBlend in="SourceGraphic" in2="goo" />
            </filter>
          </defs>
        </svg>

        <div
          className="goo-layer"
          aria-hidden="true"
          style={{
            filter: `url(#${filterId}) drop-shadow(0 6px 16px rgba(0, 0, 0, 0.45))`,
          }}
        >
          <svg
            className="goo-body"
            viewBox="0 0 140 37"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect
              className="goo-body-shape"
              width="140"
              height="37"
              rx="18.5"
              ry="18.5"
            />
          </svg>
          <span className="goo-tail">
            <span className="goo-drop goo-drop-1" />
            <span className="goo-drop goo-drop-2" />
            <span className="goo-drop goo-drop-3" />
          </span>
        </div>

        <div className="hire-content">
          <span className="hire-label">{profile.availableLabel}</span>
          <button
            type="button"
            onClick={hide}
            aria-label="Dismiss"
            className="hire-close"
            tabIndex={phase === "in" ? 0 : -1}
          >
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
              <path
                d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
