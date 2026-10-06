/**
 * A two-event bus between the nav (which knows a tab switch has started) and
 * template.tsx (which owns the content element and animates it).
 *
 * They live in different subtrees — the nav is in layout.tsx and persists, the
 * template remounts on every segment change — so neither can hold the other's
 * ref, and React context would be torn down with the template. A module-level
 * emitter is the smallest thing that survives both.
 *
 *  - `leave`  : a switch to another tab was requested; ghost the current content.
 *               `to` is the label of the tab being switched to, for listeners
 *               (the page shell's play state) that restyle at click time.
 *  - `cancel` : that switch was abandoned (the user went back to the tab they
 *               were already on); un-ghost it. A *completed* switch needs no
 *               event: the template remounts and the ghost goes with it.
 */
export type RouteTransitionEvent = "leave" | "cancel";

type Listener = (event: RouteTransitionEvent, to?: string) => void;

const listeners = new Set<Listener>();

export const routeTransition = {
  emit(event: RouteTransitionEvent, to?: string) {
    listeners.forEach((listener) => listener(event, to));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
