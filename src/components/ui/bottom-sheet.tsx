"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const BottomSheet = DialogPrimitive.Root;
const BottomSheetTrigger = DialogPrimitive.Trigger;
const BottomSheetClose = DialogPrimitive.Close;

/** Distance (px) the sheet must be dragged down before it dismisses. */
const DISMISS_DRAG_DISTANCE = 80;

/**
 * Resolves a human-readable name for a form control: its `aria-label`, else the
 * text of the `<label for>` that points at it. Used to title the sheet.
 */
function getControlLabel(element: HTMLElement | null): string | undefined {
  if (!element) {
    return undefined;
  }
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    return ariaLabel;
  }
  if (element.id) {
    const label = element.ownerDocument.querySelector<HTMLElement>(
      `label[for="${CSS.escape(element.id)}"]`,
    );
    // Drop badges and similar extras: use only the label's own text nodes.
    const text = Array.from(label?.childNodes ?? [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) {
      return text.replace(/\s*\*$/, "");
    }
  }
  return undefined;
}

/**
 * Swipe-down-to-dismiss for a bottom-anchored surface. Spread `handlers` on the
 * grab area (handle/header) and merge `style` into the surface. Dismissal clicks
 * `closeRef`, so the owning Radix primitive stays in charge of closing.
 */
function useSheetDrag(closeRef: React.RefObject<HTMLButtonElement | null>) {
  const startY = React.useRef<number | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const handlers = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      // Let buttons inside the grab area take their own click.
      if ((event.target as HTMLElement).closest("button")) {
        return;
      }
      startY.current = event.clientY;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      if (startY.current === null) {
        return;
      }
      setOffset(Math.max(0, event.clientY - startY.current));
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      if (startY.current === null) {
        return;
      }
      const distance = event.clientY - startY.current;
      startY.current = null;
      setDragging(false);
      setOffset(0);
      if (distance > DISMISS_DRAG_DISTANCE) {
        closeRef.current?.click();
      }
    },
    onPointerCancel: () => {
      startY.current = null;
      setDragging(false);
      setOffset(0);
    },
  };

  const style: React.CSSProperties = {
    transform: offset ? `translateY(${offset}px)` : undefined,
    transition: dragging ? "none" : undefined,
  };

  return { handlers, style };
}

interface BottomSheetContentProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    "title"
  > {
  /** Heading shown at the top of the sheet; also its accessible name. */
  title: string;
}

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  BottomSheetContentProps
>(({ className, children, title, onOpenAutoFocus, style, ...props }, ref) => {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const drag = useSheetDrag(closeRef);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        ref={ref}
        // Without a description Radix warns; the title is enough context.
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (!event.defaultPrevented) {
            // Focus the sheet itself rather than the first control, so opening
            // doesn't pop the keyboard (search) or ring the close button.
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus({ preventScroll: true });
          }
        }}
        style={{ ...style, ...drag.style }}
        className={cn(
          "fixed inset-x-0 bottom-[var(--keyboard-inset,0px)] z-[60] flex max-h-[min(85dvh,calc(100dvh_-_var(--keyboard-inset,0px)_-_0.5rem))] flex-col rounded-t-2xl border-t bg-popover text-popover-foreground shadow-2xl outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className,
        )}
        {...props}
      >
        <div
          className="shrink-0 touch-none select-none"
          {...drag.handlers}
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-2">
            <DialogPrimitive.Title className="truncate text-sm font-semibold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              ref={closeRef}
              className="-mr-2 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
BottomSheetContent.displayName = "BottomSheetContent";

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  getControlLabel,
  useSheetDrag,
};
