"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, cubicBezier, utils } from "animejs";
import type { ComponentType } from "react";
import type { GalleryImage, PilePose } from "@/content/gallery";
import type { GalleryOverlayProps } from "./GalleryOverlay";

/**
 * The image pile shown in a work row, and the trigger for the fullscreen
 * carousel (GalleryOverlay).
 *
 * Idle: a loosely fanned static pile. Hover (mouse only): the fan widens.
 * Press: the whole pile compresses slightly, as anticipation. Release: the
 * carousel opens, and the pile stays hidden until the close animation lands
 * back on it.
 *
 * The cards are the same pictures the overlay flies out, so this component also
 * exposes their live poses (see `getPile`) for the FLIP in the overlay.
 */

/** Longest a card may be in each dimension, before aspect is applied. */
const CARD_BOX = { width: 108, height: 78 };
const PRESS_SCALE = 0.94;
/**
 * Cards beyond this rank share the last visible slot and are hidden, so a long
 * gallery still reads as a small pile and the hover fan stays inside the row.
 * They still exist, so they still fly out and back with everything else.
 */
const MAX_VISIBLE = 4;

const settleEase = cubicBezier(0.16, 1, 0.3, 1);
const overshootEase = cubicBezier(0.34, 1.56, 0.64, 1);

let overlayModule: Promise<typeof import("./GalleryOverlay")> | null = null;
const loadOverlay = () => (overlayModule ??= import("./GalleryOverlay"));

interface CardPose {
  x: number;
  y: number;
  rotate: number;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Poses are by *rank* in the pile (0 = top), not by image index: the pile
 * remembers the last image you viewed and rotates it to the top.
 *
 * Rank 0 is nearly straight; the rest peek out alternately.
 */
function restPose(rawRank: number): CardPose {
  const rank = Math.min(rawRank, MAX_VISIBLE - 1);
  const side = rank % 2 === 1 ? 1 : -1;
  return {
    x: rank === 0 ? 0 : side * (2 + rank * 2.5),
    y: -rank * 2,
    rotate: rank === 0 ? -1.5 : side * (2.5 + rank * 2),
  };
}

/**
 * Hand-of-cards fan with the top card in the middle and the rest alternating
 * to its right and left: ranks 0,1,2,3,4 -> slots 0,+1,-1,+2,-2.
 */
function hoverPose(rawRank: number): CardPose {
  const rank = Math.min(rawRank, MAX_VISIBLE - 1);
  const slot = rank === 0 ? 0 : rank % 2 === 1 ? (rank + 1) / 2 : -rank / 2;
  return { x: slot * 22, y: Math.abs(slot) * 4 - 4, rotate: slot * 7 };
}

const toParams = (p: CardPose) => ({
  x: p.x,
  y: p.y,
  rotate: `${p.rotate}deg`,
});

function fitCard(image: GalleryImage) {
  const scale = Math.min(
    CARD_BOX.width / image.width,
    CARD_BOX.height / image.height,
  );
  return {
    width: Math.round(image.width * scale),
    height: Math.round(image.height * scale),
  };
}

export default function WorkGallery({
  images,
  label,
  caption,
}: {
  images: GalleryImage[];
  /** Accessible name for the button. */
  label: string;
  /** Short visible caption under the pile. */
  caption: string;
}) {
  const [open, setOpen] = useState(false);
  const [Overlay, setOverlay] =
    useState<ComponentType<GalleryOverlayProps> | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [startIndex, setStartIndex] = useState(0);
  /** Image currently on top of the pile. Ref, not state: only read imperatively. */
  const top = useRef(0);
  const pressed = useRef(false);
  const opening = useRef(false);
  const warm = useRef<Promise<unknown> | null>(null);
  // Held so the browser keeps the decoded bitmaps around for the overlay.
  const warmImages = useRef<HTMLImageElement[]>([]);

  const cards = () => cardRefs.current.filter((c): c is HTMLSpanElement => !!c);

  // Give Anime its own starting state, matching the inline SSR transform.
  useLayoutEffect(() => {
    cards().forEach((card, i) => utils.set(card, toParams(restPose(i))));
  }, []);

  const fan = (mode: "rest" | "hover") => {
    const n = images.length;
    cards().forEach((card, i) => {
      const rank = mod(i - top.current, n);
      // Stashed cards are invisible, but they still count towards the page's
      // scroll width, so they must not swing out with the fan.
      const fanned = mode === "hover" && rank < MAX_VISIBLE;
      animate(card, {
        ...toParams(fanned ? hoverPose(rank) : restPose(rank)),
        duration: mode === "hover" ? 420 : 340,
        ease: settleEase,
      });
    });
  };

  const setPressed = (on: boolean) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    animate(trigger, {
      scale: on ? PRESS_SCALE : 1,
      duration: on ? 140 : 320,
      ease: on ? "outQuad" : overshootEase,
    });
  };

  /** Fetch the overlay chunk and decode every thumb once, on first intent. */
  const prewarm = () => {
    loadOverlay();
    if (!warm.current) {
      warm.current = Promise.all(
        images.map((image) => {
          const el = new Image();
          el.src = image.thumbSrc;
          warmImages.current.push(el);
          return el.decode().catch(() => undefined);
        }),
      );
    }
    return warm.current;
  };

  const openGallery = async () => {
    if (opening.current || open) return;
    opening.current = true;
    try {
      const mod = await loadOverlay();
      // Never hold the click hostage to a slow image.
      await Promise.race([
        prewarm(),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
      setOverlay(() => mod.default);
      setStartIndex(top.current);
      setOpen(true);
    } catch {
      setPressed(false);
    } finally {
      opening.current = false;
    }
  };

  /**
   * Live pose of every card. On close the pile is first snapped back to rest —
   * it may still be in a hover fan or press state underneath the overlay — so
   * the flight lands on where the pile will actually reappear.
   */
  const getPile = useCallback((settle: boolean, newTop: number): PilePose[] => {
    const trigger = triggerRef.current;
    const list = cardRefs.current.filter((c): c is HTMLSpanElement => !!c);
    if (!trigger) return [];
    const n = list.length;

    if (settle) {
      // The pile re-forms with the image you were last viewing on top.
      top.current = mod(newTop, n);
      utils.set(trigger, { scale: 1 });
      list.forEach((card, i) => {
        const rank = mod(i - top.current, n);
        utils.set(card, toParams(restPose(rank)));
        card.style.zIndex = String(n - rank);
        card.style.opacity = rank < MAX_VISIBLE ? "1" : "0";
      });
    }

    const parent = new DOMMatrix(getComputedStyle(trigger).transform);
    const parentScale = Math.hypot(parent.a, parent.b);

    return list.map((card) => {
      const m = new DOMMatrix(getComputedStyle(card).transform);
      const scale = Math.hypot(m.a, m.b) * parentScale;
      const rect = card.getBoundingClientRect();
      return {
        // Rotation and uniform scale both pivot on the centre, so the bounding
        // box of a rotated card is still centred on the card.
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        width: card.offsetWidth * scale,
        rotate: (Math.atan2(m.b, m.a) * 180) / Math.PI,
        z: Number(card.style.zIndex) || 0,
        visible: card.style.opacity !== "0",
      };
    });
  }, []);

  const handleClosed = useCallback(() => {
    setOpen(false);
    // Same commit as the overlay unmounting, so the pile is back on the frame
    // the last card lands.
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (open) pressed.current = false;
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="pile"
        aria-label={label}
        aria-haspopup="dialog"
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          prewarm();
          fan("hover");
        }}
        onPointerLeave={(e) => {
          if (pressed.current) {
            pressed.current = false;
            setPressed(false);
          }
          if (e.pointerType === "mouse" && !open) fan("rest");
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          pressed.current = true;
          prewarm();
          setPressed(true);
        }}
        onPointerUp={() => {
          if (!pressed.current) return;
          pressed.current = false;
          openGallery();
        }}
        onPointerCancel={() => {
          // A touch that turned into a scroll.
          if (!pressed.current) return;
          pressed.current = false;
          setPressed(false);
        }}
        onFocus={() => prewarm()}
        onClick={(e) => {
          // Pointer activations already opened on release; this is the
          // keyboard / assistive-tech path (detail is 0 for those).
          if (e.detail === 0) openGallery();
        }}
      >
        {/* Only the cards hide while the carousel is open; the caption stays
            put so it doesn't blink out and back. */}
        <span className="pile-stack" data-hidden={open}>
          {images.map((image, i) => {
            const { width, height } = fitCard(image);
            const rest = restPose(i);
            return (
              <span
                key={image.id}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className="pile-card"
                style={{
                  width,
                  height,
                  marginLeft: -width / 2,
                  marginTop: -height / 2,
                  zIndex: images.length - i,
                  opacity: i < MAX_VISIBLE ? 1 : 0,
                  transform: `translate(${rest.x}px, ${rest.y}px) rotate(${rest.rotate}deg)`,
                }}
              >
                {/* Plain <img>: the overlay must show this exact URL, so it
                    can't go through the optimiser's per-width variants. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.thumbSrc} alt="" draggable={false} />
              </span>
            );
          })}
        </span>
        <span className="pile-caption" aria-hidden="true">
          {caption}
        </span>
      </button>

      {Overlay && open && (
        <Overlay
          images={images}
          startIndex={startIndex}
          getPile={getPile}
          onClosed={handleClosed}
        />
      )}
    </>
  );
}
