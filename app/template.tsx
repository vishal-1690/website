"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { waapi, type WAAPIAnimation } from "animejs";
import { routeTransition } from "@/lib/route-transition";

/** Where the outgoing content settles while it waits for the next page. */
const GHOST = { opacity: 0.4, scale: 0.97, duration: 150 };
/** The incoming content's pop: a plain ease-out, no overshoot. */
const ENTER = { opacity: 0.0, scale: 0.955, duration: 260 };
const EASE_OUT = "cubic-bezier(0.32, 0.72, 0, 1)";
/** If the next page never arrives, don't leave the old one ghosted forever. */
const GHOST_TIMEOUT_MS = 10_000;

// The first mount is the server-rendered page being hydrated; it is already on
// screen, so animating it would only make it flash. Cleared in a microtask so
// React StrictMode's synchronous double-invoke in dev still counts as one mount.
let isInitialMount = true;
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Templates get a fresh key when their segment changes, so this component
 * remounts on every tab switch. That gives us both halves of the transition:
 *
 *  - **Exit** — the nav emits `leave` the moment a tab is clicked. We shrink and
 *    dim *this* content and hold it there, like a ghost. Next keeps the old tree
 *    mounted until the next page's payload is ready, so if that takes a while the
 *    ghost is simply what the user is looking at: a clear "something is coming".
 *  - **Enter** — when the next page is ready this instance is unmounted and a new
 *    one mounts. Its layout effect (before paint, so no flash of the final state)
 *    pops it in.
 *
 * Both are Web Animations driven through Anime's `waapi` module, so opacity and
 * transform run on the compositor and survive a busy main thread, which is
 * exactly when a route change is happening. No blur: filter on a whole page is
 * the expensive part of the old transition.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (isInitialMount) {
      queueMicrotask(() => {
        isInitialMount = false;
      });
      return;
    }
    if (reducedMotion()) return;

    const enter = waapi.animate(el, {
      opacity: [ENTER.opacity, 1],
      transform: [`scale(${ENTER.scale})`, "scale(1)"],
      duration: ENTER.duration,
      ease: EASE_OUT,
      // A leftover `transform` (even scale(1)) would become the containing block
      // for any fixed-position descendant, so remove it rather than keep it.
      onComplete: () => {
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
      },
    });
    return () => {
      // `revert`, not `cancel`: cancel commits the mid-flight values to inline
      // style, which would leave the page stuck at its first frame.
      enter.revert();
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let ghost: WAAPIAnimation | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const release = () => {
      clearTimeout(timeout);
      if (!ghost) return;
      // Animate back rather than snapping, then drop the inline styles.
      const back = ghost;
      ghost = null;
      back.cancel();
      el.removeAttribute("data-ghost");
      waapi.animate(el, {
        opacity: 1,
        transform: "scale(1)",
        duration: GHOST.duration,
        ease: EASE_OUT,
        onComplete: () => {
          el.style.removeProperty("transform");
          el.style.removeProperty("opacity");
        },
      });
    };

    const unsubscribe = routeTransition.subscribe((event) => {
      if (event === "cancel") return release();
      if (ghost || reducedMotion()) return;
      el.setAttribute("data-ghost", "");
      ghost = waapi.animate(el, {
        opacity: GHOST.opacity,
        transform: `scale(${GHOST.scale})`,
        duration: GHOST.duration,
        ease: EASE_OUT,
        // Held, not finished: the animation keeps owning these values until the
        // template unmounts (new page arrived) or `cancel` releases it.
        persist: true,
      });
      timeout = setTimeout(release, GHOST_TIMEOUT_MS);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
      ghost?.cancel();
    };
  }, []);

  return (
    <div ref={ref} className="route-body">
      {children}
    </div>
  );
}
