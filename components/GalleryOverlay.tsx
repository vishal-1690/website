"use client";

import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { animate, createTimeline, cubicBezier, utils } from "animejs";
import type { GalleryImage, PilePose } from "@/content/gallery";

/**
 * Fullscreen carousel that the pile spreads into.
 *
 * Division of labour (same as HireBubble): the DOM is measured, plain maths
 * decides where everything goes, Anime.js interpolates the numbers.
 *
 * - `state.p` is the fractional carousel index. Every slide's position, blur
 *   and darkness is a pure function of it (`render`), so dragging, clicking,
 *   arrow keys and the settle animation can never disagree.
 * - Each slide is two elements. The outer one is written by `render` (carousel
 *   position + blur). The inner one (`flip`) is animated by Anime and carries
 *   the offset between the slide's carousel pose and its pile card, so the
 *   spread and the return are the same tween run in opposite directions.
 * - `state.r` (0..1) scales the blur/darkening in, so the first frame of the
 *   spread is pixel-identical to the pile.
 */

export interface GalleryOverlayProps {
  images: GalleryImage[];
  startIndex: number;
  /** Pile card poses. `settle` snaps the pile to rest first (used on close). */
  getPile: (settle: boolean, top: number) => PilePose[];
  onClosed: () => void;
}

const OPEN_EASE = cubicBezier(0.16, 1, 0.3, 1);

// Geometry that has to morph between the pile card and the slide. The pile's
// values are real px on a small card; they are divided by the flight scale so
// they look identical on the first frame. Keep in sync with .pile-card.
/** Images either side of the centred one that also fly out of / into the pile. */
const FLY_RADIUS = 2;

// The frame matches the company logo tiles: a 2px border in --border-tile.
const SLIDE = { radius: 14, frame: 3, imageRadius: 11 };
const PILE = { radius: 5, frame: 2, imageRadius: 3 };

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const mod = (a: number, n: number) => ((a % n) + n) % n;

export default function GalleryOverlay({
  images,
  startIndex,
  getPile,
  onClosed,
}: GalleryOverlayProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const closeFn = useRef<(dir: number) => void>(() => {});

  useLayoutEffect(() => {
    const stage = stageRef.current!;
    const backdrop = backdropRef.current!;
    const track = trackRef.current!;
    const closeBtn = closeRef.current!;
    const slides = slideRefs.current.map((s) => s!);
    const flips = flipRefs.current.map((s) => s!);
    const N = images.length;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = (ms: number) => (reduce ? 1 : ms);

    type Phase = "opening" | "open" | "closing";
    let phase: Phase = "opening";

    // Animated values. `bd` is backdrop/chrome opacity, `dy` is the vertical
    // dismiss offset, `flying` keeps every slide visible mid-spread.
    const state = { p: startIndex, r: 0, bd: 0, dy: 0, flying: true };

    let W = 0;
    let H = 0;
    let phone = false;
    let sizes: { w: number; h: number }[] = [];
    let gap = 0;
    /** Slide centres along one lap of the strip. */
    let centers: number[] = [];
    /** Length of one lap: the strip repeats every `lap` px, so it never ends. */
    let lap = 0;

    /* --- Layout ------------------------------------------------------------ */

    const layout = () => {
      const rect = stage.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      phone = W < 768;

      // Phone: as close to the full viewport as the image allows. Desktop: a
      // generous box that leaves the neighbours and the close button visible.
      const boxW = phone ? W - 16 : Math.min(W * 0.7, 1200);
      const boxH = phone ? H - 32 : H * 0.74;
      gap = phone ? 12 : Math.max(32, W * 0.04);

      sizes = images.map((im) => {
        const s = Math.min(boxW / im.width, boxH / im.height);
        return { w: im.width * s, h: im.height * s };
      });

      let run = 0;
      centers = sizes.map((s) => {
        const c = run + s.w / 2;
        run += s.w + gap;
        return c;
      });
      lap = run;

      slides.forEach((el, i) => {
        el.style.width = `${sizes[i].w}px`;
        el.style.height = `${sizes[i].h}px`;
        el.style.marginLeft = `${-sizes[i].w / 2}px`;
        el.style.marginTop = `${-sizes[i].h / 2}px`;
      });
    };

    // `p` is unbounded (index 7 is image 2 on its second lap), and the strip is
    // a loop: a slide's centre repeats every `lap` px.

    /** Fractional index -> x of the viewport centre along the unrolled strip. */
    const pToPos = (p: number) => {
      const f = Math.floor(p);
      const i = mod(f, N);
      const laps = (f - i) / N;
      const next = (i + 1) % N;
      const step = (sizes[i].w + sizes[next].w) / 2 + gap;
      return centers[i] + laps * lap + (p - f) * step;
    };

    /** Inverse of pToPos. */
    const posToP = (pos: number) => {
      const laps = Math.floor((pos - centers[0]) / lap);
      const q = pos - laps * lap;
      let k = N - 1;
      for (let j = 0; j < N - 1; j++) {
        if (q < centers[j + 1]) {
          k = j;
          break;
        }
      }
      const next = k === N - 1 ? centers[0] + lap : centers[k + 1];
      return laps * N + k + (q - centers[k]) / (next - centers[k]);
    };

    /** Slide i's x relative to the viewport centre: its nearest copy on the loop. */
    const relX = (i: number) =>
      mod(centers[i] - pToPos(state.p) + lap / 2, lap) - lap / 2;

    /** Signed index distance from `p` to slide i, wrapped to [-N/2, N/2). */
    const idxDist = (i: number) => mod(i - state.p + N / 2, N) - N / 2;

    /** Cyclic distance between two image indices. */
    const lapDist = (a: number, b: number) => {
      const d = mod(a - b, N);
      return Math.min(d, N - d);
    };

    /**
     * Which slides travel between pile and carousel: the cards visible in the
     * pile (so nothing vanishes from it on click) plus the centred image and
     * FLY_RADIUS either side, which are the ones on screen. A long gallery no
     * longer means a long, heavy choreography.
     */
    const flies = (i: number, pile: PilePose[], centre: number) =>
      pile[i].visible || lapDist(i, centre) <= FLY_RADIUS;

    /* --- Full-size media --------------------------------------------------- */

    // Each slide starts as its thumb (the same picture as the pile card). The
    // full asset is stacked over it and faded in once it can show a frame, so
    // there is never a swap. Videos and animated images are mounted for the
    // active slide only; stills are kept for the active slide and its
    // neighbours.
    type Full = HTMLImageElement | HTMLVideoElement;
    const full: (Full | null)[] = images.map(() => null);
    let lastActive = -1;

    const reveal = (el: Full) => {
      if (phase !== "closing") el.style.opacity = "1";
    };

    const mountFull = (i: number): Full => {
      const existing = full[i];
      if (existing) return existing;
      const image = images[i];
      let el: Full;
      if (image.kind === "video") {
        const video = document.createElement("video");
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "auto";
        video.src = image.src;
        // "playing", not "loadeddata": there must be a frame on screen.
        video.addEventListener("playing", () => reveal(video), { once: true });
        el = video;
      } else {
        const img = new Image();
        img.decoding = "async";
        img.src = image.src;
        img.decode().then(() => reveal(img), () => {});
        el = img;
      }
      el.className = "gallery-full";
      el.setAttribute("aria-hidden", "true");
      (el as HTMLElement).draggable = false;
      flips[i].appendChild(el);
      full[i] = el;
      return el;
    };

    const disposeFull = (i: number) => {
      const el = full[i];
      if (!el) return;
      if (el instanceof HTMLVideoElement) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
      el.remove();
      full[i] = null;
    };

    const syncMedia = () => {
      if (phase !== "open") return;
      const active = mod(Math.round(state.p), N);
      lastActive = active;
      for (let i = 0; i < N; i++) {
        const image = images[i];
        const near = lapDist(i, active);
        if (near === 0) {
          const el = mountFull(i);
          if (el instanceof HTMLVideoElement) el.play().catch(() => {});
        } else if (image.animated) {
          // Can't pause an animated image, so it's dropped; videos are kept
          // one step away, paused, and dropped beyond that.
          const el = full[i];
          if (el instanceof HTMLVideoElement && near === 1) el.pause();
          else disposeFull(i);
        } else if (near === 1) {
          mountFull(i);
        }
      }
    };

    /* --- Rendering --------------------------------------------------------- */

    const render = () => {
      if (phase === "open" && mod(Math.round(state.p), N) !== lastActive) {
        syncMedia();
      }
      const blur = phone ? 6 : 10;
      for (let i = 0; i < N; i++) {
        const el = slides[i];
        const x = relX(i);
        const d = Math.min(1, Math.abs(idxDist(i))) * state.r;
        el.style.transform = `translate3d(${x}px,0,0) scale(${1 - d * 0.06})`;
        el.style.filter =
          d > 0.001
            ? `blur(${d * blur}px) brightness(${1 - d * 0.55})`
            : "none";
        // Far off-screen slides cost nothing while they stay hidden.
        const off = Math.abs(x) - sizes[i].w / 2 > W / 2 + 40;
        el.style.visibility = !state.flying && off ? "hidden" : "visible";
      }
    };

    /** Backdrop, close button and the vertical-dismiss transform. */
    const chrome = () => {
      const prog = clamp(Math.abs(state.dy) / (H * 0.4), 0, 1);
      backdrop.style.opacity = String(state.bd * (1 - prog * 0.85));
      closeBtn.style.opacity = String(state.bd * (1 - prog));
      track.style.transform =
        state.dy === 0
          ? "none"
          : `translate3d(0,${state.dy}px,0) scale(${1 - prog * 0.15})`;
    };

    /* --- FLIP -------------------------------------------------------------- */

    /** The inner element's offset that puts slide i exactly on its pile card. */
    const flipFor = (i: number, pile: PilePose[]) => {
      const card = pile[i];
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + W / 2 + relX(i);
      const cy = rect.top + H / 2;
      const scale = card.width / sizes[i].w;
      return {
        x: card.cx - cx,
        y: card.cy - cy,
        scale,
        rotate: `${card.rotate}deg`,
        borderRadius: `${PILE.radius / scale}px`,
        "--frame": `${PILE.frame / scale}px`,
        "--ir": `${PILE.imageRadius / scale}px`,
      };
    };

    /** Rest state of a slide's inner element inside the carousel. */
    const slideRest = {
      x: 0,
      y: 0,
      scale: 1,
      rotate: "0deg",
      borderRadius: `${SLIDE.radius}px`,
      "--frame": `${SLIDE.frame}px`,
      "--ir": `${SLIDE.imageRadius}px`,
    };

    /** Stack slides like the pile so overlap in flight matches it. */
    const applyPileOrder = (pile: PilePose[]) => {
      pile.forEach((card, i) => {
        slides[i].style.zIndex = String(card.z);
      });
    };


    /* --- Navigation -------------------------------------------------------- */

    let pAnim: ReturnType<typeof animate> | null = null;
    let dismissAnim: ReturnType<typeof animate> | null = null;
    let openTl: ReturnType<typeof createTimeline> | null = null;
    let closeTl: ReturnType<typeof createTimeline> | null = null;

    /** Where the last navigation is heading, so rapid key presses accumulate. */
    let heading = startIndex;

    const goTo = (target: number) => {
      heading = target;
      pAnim?.pause();
      pAnim = animate(state, {
        p: target,
        duration: dur(520),
        ease: OPEN_EASE,
        onUpdate: render,
      });
    };

    const close = (dir: number) => {
      if (phase === "closing") return;
      phase = "closing";
      // Back to the thumb first: that is the picture the pile shows.
      full.forEach((el) => {
        if (!el) return;
        el.style.opacity = "0";
        if (el instanceof HTMLVideoElement) el.pause();
      });
      openTl?.pause();
      pAnim?.pause();
      dismissAnim?.pause();

      // Whatever is centred becomes the top of the re-formed pile.
      const start = mod(Math.round(state.p), N);
      const pile = getPile(true, start);
      applyPileOrder(pile);
      state.flying = true;
      render();

      // `dir` (-1 up, +1 down, 0 none) only sets the hand-off: the tween starts
      // from wherever the swipe left the track, so the group carries the swipe's
      // momentum into the return. Unwinding it back to 0 lands on the pile.
      closeTl = createTimeline({
        defaults: { ease: OPEN_EASE },
        onComplete: () => {
          // Closed by button, Esc or swipe: drop the history entry we pushed.
          // (Closed by the browser's back: it is already gone.)
          if (window.history.state?.gallery) window.history.back();
          onClosed();
        },
      });
      for (let i = 0; i < N; i++) {
        const at = dur(lapDist(i, start) * 40);
        if (!flies(i, pile, start)) {
          // Nowhere to go: too far from the action to be seen returning.
          closeTl.add(slides[i], { opacity: 0, duration: dur(200) }, 0);
          continue;
        }
        closeTl.add(flips[i], { ...flipFor(i, pile), duration: dur(520) }, at);
        // Its pile slot is hidden, so it dissolves into the pile on the way.
        if (!pile[i].visible) {
          closeTl.add(slides[i], { opacity: 0, duration: dur(260) }, at + dur(260));
        }
      }
      closeTl
        .add(
          state,
          {
            r: 0,
            dy: 0,
            duration: dur(360),
            onUpdate: () => {
              render();
              chrome();
            },
          },
          0,
        )
        .add(state, { bd: 0, duration: dur(300), onUpdate: chrome }, dur(240));
      void dir;
    };
    closeFn.current = close;

    /* --- Gestures ---------------------------------------------------------- */

    interface Drag {
      id: number;
      type: string;
      x: number;
      y: number;
      startP: number;
      axis: "x" | "y" | null;
      samples: { t: number; x: number; y: number }[];
      target: EventTarget | null;
    }
    let drag: Drag | null = null;

    const velocity = (d: Drag) => {
      const now = performance.now();
      const recent = d.samples.filter((s) => now - s.t < 100);
      const first = recent[0];
      const last = recent[recent.length - 1];
      if (!first || !last || last.t === first.t) return { vx: 0, vy: 0 };
      const dt = last.t - first.t;
      return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (phase !== "open" || drag || e.button !== 0) return;
      if ((e.target as Element).closest("button")) return;
      pAnim?.pause();
      dismissAnim?.pause();
      drag = {
        id: e.pointerId,
        type: e.pointerType,
        x: e.clientX,
        y: e.clientY,
        startP: state.p,
        axis: null,
        samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }],
        target: e.target,
      };
      stage.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
      if (drag.samples.length > 12) drag.samples.shift();

      if (!drag.axis && Math.hypot(dx, dy) > 8) {
        drag.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      }

      if (drag.axis === "x") {
        state.p = posToP(pToPos(drag.startP) - dx);
        render();
      } else if (drag.axis === "y" && drag.type !== "mouse") {
        // Vertical dismiss is a touch gesture; mouse users have × and Esc.
        state.dy = dy;
        chrome();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      const { vx, vy } = velocity(d);

      if (d.axis === "x") {
        // Project where the flick would coast to, but never skip an image.
        const projected = pToPos(state.p) - vx * 200;
        const base = Math.round(d.startP);
        goTo(clamp(Math.round(posToP(projected)), base - 1, base + 1));
      } else if (d.axis === "y" && d.type !== "mouse") {
        if (Math.abs(dy) > H * 0.16 || Math.abs(vy) > 0.6) {
          close(Math.sign(dy || vy));
        } else {
          dismissAnim = animate(state, {
            dy: 0,
            duration: dur(320),
            ease: OPEN_EASE,
            onUpdate: chrome,
          });
        }
      } else if (!d.axis && Math.hypot(dx, dy) < 8) {
        // A tap: a neighbour navigates, empty backdrop closes on desktop.
        const slide = (d.target as Element | null)?.closest("[data-slide]");
        if (slide) {
          const index = Number(slide.getAttribute("data-slide"));
          // Nearest copy of that image, which may be a lap away.
          const here = Math.round(state.p);
          const delta = mod(index - here + N / 2, N) - N / 2;
          if (delta !== 0) goTo(here + delta);
        } else if (d.type === "mouse") {
          close(0);
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(0);
      } else if (phase !== "open") {
        return;
      } else if (e.key === "ArrowRight") {
        goTo(heading + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(heading - 1);
      } else if (e.key === "Tab") {
        // The close button is the only focusable thing inside.
        e.preventDefault();
        closeBtn.focus({ preventScroll: true });
      }
    };

    const onResize = () => {
      layout();
      render();
    };

    // iOS's edge-swipe back can't be cancelled from the page (it's a system
    // gesture, not a touch event), and Android's back button would leave the
    // page too. So the gallery gets its own history entry: back closes the
    // gallery, and the page underneath stays where it is.
    const onPopState = () => {
      if (phase === "closing") return;
      close(0);
    };
    if (!window.history.state?.gallery) {
      window.history.pushState({ ...window.history.state, gallery: true }, "");
    }
    /* --- Open -------------------------------------------------------------- */

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    layout();
    render();
    chrome();

    // Before the first paint: put every slide exactly on its pile card.
    const pile = getPile(false, startIndex);
    applyPileOrder(pile);
    for (let i = 0; i < N; i++) {
      if (!flies(i, pile, startIndex)) {
        slides[i].style.opacity = "0";
        continue;
      }
      utils.set(flips[i], flipFor(i, pile));
      if (!pile[i].visible) slides[i].style.opacity = "0";
    }

    openTl = createTimeline({
      defaults: { ease: OPEN_EASE },
      onComplete: () => {
        state.flying = false;
        phase = "open";
        syncMedia();
        render();
      },
    });
    // Outward from the starting image, so the pile deals itself into the row.
    for (let i = 0; i < N; i++) {
      if (!flies(i, pile, startIndex)) {
        openTl.add(slides[i], { opacity: 1, duration: dur(300) }, dur(260));
        continue;
      }
      const at = dur(lapDist(i, startIndex) * 50);
      openTl.add(flips[i], { ...slideRest, duration: dur(620) }, at);
      // Not part of the visible pile, so it emerges from it rather than
      // popping on top of it.
      if (!pile[i].visible) {
        openTl.add(slides[i], { opacity: 1, duration: dur(240) }, at);
      }
    }
    openTl
      .add(state, { bd: 1, duration: dur(280), onUpdate: chrome }, 0)
      .add(state, { r: 1, duration: dur(420), onUpdate: render }, dur(200));

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("popstate", onPopState);
    closeBtn.focus({ preventScroll: true });

    return () => {
      openTl?.pause();
      closeTl?.pause();
      pAnim?.pause();
      dismissAnim?.pause();
      for (let i = 0; i < N; i++) disposeFull(i);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("popstate", onPopState);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [images, startIndex, getPile, onClosed]);

  return createPortal(
    <div
      ref={stageRef}
      className="gallery-stage"
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
    >
      <div ref={backdropRef} className="gallery-backdrop" />
      <div ref={trackRef} className="gallery-track">
        {images.map((image, i) => (
          <div
            key={image.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className="gallery-slide"
            data-slide={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${images.length}: ${image.alt}`}
          >
            <div
              ref={(el) => {
                flipRefs.current[i] = el;
              }}
              className="gallery-flip"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="gallery-thumb"
                src={image.thumbSrc}
                alt={image.alt}
                draggable={false}
              />
            </div>
          </div>
        ))}
      </div>
      <button
        ref={closeRef}
        type="button"
        className="gallery-close"
        aria-label="Close gallery"
        onClick={() => closeFn.current(0)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
