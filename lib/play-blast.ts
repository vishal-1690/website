/**
 * Off for now: entering play uses the plain colour fade. Flip to true to bring
 * the blast back; nothing else needs to change (see docs/play-state.md, decision
 * 9). While off, `blast()` returns false and the caller takes the normal path.
 */
const ENABLED = false;

/** How long the circle takes to cover the screen. */
const BLAST_MS = 200;
/** Same curve as the rest of the play state (--mode-ease). */
const BLAST_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Entering play is revealed by a circle that grows from the click and shows the
 * new page through it, instead of the whole page cross-fading.
 *
 * This is a View Transition: the browser snapshots the page as it is, `update`
 * runs and changes it, and the live result is shown *over* the snapshot, clipped
 * to a circle that we animate. The clip runs on the compositor, so it holds up
 * while the route is changing underneath.
 *
 * `update` must apply the change synchronously (the caller wraps it in flushSync):
 * the browser takes the "after" picture the moment the callback returns.
 *
 * Returns false, and does nothing, where it can't or shouldn't run (no support,
 * reduced motion); the caller then makes the change as usual and gets the
 * ordinary colour transition.
 */
export function blast(
  origin: { x: number; y: number },
  update: () => void,
): boolean {
  if (
    !ENABLED ||
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return false;
  }

  const root = document.documentElement;
  // Before the snapshot, so the colour tokens are already set not to transition
  // when `update` changes them.
  root.setAttribute("data-blast", "");

  const transition = document.startViewTransition(update);

  transition.ready.then(() => {
    const { x, y } = origin;
    // Far enough to cover the farthest corner, wherever the click was.
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    root.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${radius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: BLAST_MS,
        easing: BLAST_EASE,
        pseudoElement: "::view-transition-new(root)",
      },
    );
  }, () => {
    // The transition was skipped; nothing to animate.
  });

  transition.finished
    .catch(() => {})
    .finally(() => root.removeAttribute("data-blast"));

  return true;
}
