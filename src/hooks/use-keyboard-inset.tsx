"use client";

import { useEffect } from "react";

/** CSS custom property holding the height (px) of the on-screen keyboard. */
const INSET_VAR = "--keyboard-inset";

/**
 * Anything smaller than this is browser chrome (URL bar collapsing, etc.),
 * not a soft keyboard, so it is ignored.
 */
const MIN_KEYBOARD_HEIGHT = 120;

function isEditable(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element.isContentEditable) {
    return true;
  }
  if (element instanceof HTMLTextAreaElement) {
    return true;
  }
  if (element instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "submit", "reset", "file", "range", "color", "image"].includes(
      element.type,
    );
  }
  return false;
}

/**
 * Mobile browsers (iOS Safari, Chrome/Firefox on Android) keep the layout
 * viewport the same size when the soft keyboard opens and only shrink the
 * *visual* viewport. Anything `position: fixed` to the bottom (sheets, dialogs,
 * toasts) therefore ends up hidden behind the keyboard.
 *
 * This keeps `--keyboard-inset` on `<html>` in sync with the keyboard height so
 * overlays can lift themselves with `bottom: var(--keyboard-inset, 0px)` and cap
 * their height with `100dvh - var(--keyboard-inset, 0px)`. When the browser
 * resizes the layout viewport itself the inset stays `0px`, which is also right.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const root = document.documentElement;
    let inset = 0;
    let scrollTimer: number | undefined;

    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      const next = covered >= MIN_KEYBOARD_HEIGHT ? Math.round(covered) : 0;
      if (next === inset) {
        return;
      }
      const opened = inset === 0 && next > 0;
      inset = next;
      root.style.setProperty(INSET_VAR, `${next}px`);

      // Once the keyboard is up (and the overlay has moved), make sure the
      // field being typed in is not underneath it.
      if (opened || next > 0) {
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(() => {
          const active = document.activeElement;
          if (isEditable(active)) {
            active.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }, 100);
      }
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.clearTimeout(scrollTimer);
      root.style.removeProperty(INSET_VAR);
    };
  }, []);
}

/** Mount once near the root so every overlay can use `--keyboard-inset`. */
export function KeyboardInsetObserver(): null {
  useKeyboardInset();
  return null;
}
