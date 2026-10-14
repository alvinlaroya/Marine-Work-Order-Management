"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTrigger,
  getControlLabel,
} from "@/components/ui/bottom-sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

/**
 * Set only while the menu is rendered as a bottom sheet (mobile). Every part of
 * the menu checks it to decide between the Radix menu and the sheet markup.
 */
interface MobileMenuContextValue {
  title: string;
  setTitle: (title: string) => void;
  /** Close the sheet, then run `action` once it has fully closed. */
  select: (action: () => void) => void;
  /** Run (and clear) the action queued by `select`. */
  flush: () => void;
  hasPendingAction: () => boolean;
  /** Close the sheet immediately. */
  close: () => void;
}

const MobileMenuContext = React.createContext<MobileMenuContextValue | null>(null);

function MobileDropdownMenu({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: Pick<
  React.ComponentProps<typeof DropdownMenuPrimitive.Root>,
  "open" | "defaultOpen" | "onOpenChange" | "children"
>) {
  const [openState, setOpenState] = React.useState(defaultOpen);
  const open = openProp ?? openState;
  const [title, setTitle] = React.useState("Actions");
  const pending = React.useRef<(() => void) | null>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const value = React.useMemo<MobileMenuContextValue>(
    () => ({
      title,
      setTitle,
      select: (action) => {
        pending.current = action;
        setOpen(false);
      },
      flush: () => {
        const action = pending.current;
        pending.current = null;
        action?.();
      },
      hasPendingAction: () => pending.current !== null,
      close: () => setOpen(false),
    }),
    [title, setOpen],
  );

  return (
    <MobileMenuContext.Provider value={value}>
      <BottomSheet open={open} onOpenChange={setOpen}>
        {children}
      </BottomSheet>
    </MobileMenuContext.Provider>
  );
}

/**
 * Renders a popover menu on desktop and a bottom sheet below the `md` breakpoint.
 *
 * The desktop menu is non-modal. A modal menu locks the page with
 * `pointer-events: none`, and when one of its items opens a Dialog the two locks
 * race, which can leave the whole page unclickable after the dialog closes.
 */
function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileDropdownMenu open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        {children}
      </MobileDropdownMenu>
    );
  }
  return (
    <DropdownMenuPrimitive.Root
      modal={false}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Root>
  );
}

const DropdownMenuTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ onClick, ...props }, ref) => {
  const mobile = React.useContext(MobileMenuContext);

  if (!mobile) {
    return <DropdownMenuPrimitive.Trigger ref={ref} onClick={onClick} {...props} />;
  }
  return (
    <BottomSheetTrigger
      ref={ref}
      {...(props as React.ComponentPropsWithoutRef<typeof BottomSheetTrigger>)}
      onClick={(event) => {
        mobile.setTitle(getControlLabel(event.currentTarget) ?? "Actions");
        onClick?.(event);
      }}
    />
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, children, ...props }, ref) => {
  const mobile = React.useContext(MobileMenuContext);

  if (mobile) {
    return (
      <BottomSheetContent
        title={mobile.title}
        // Run the chosen action only once the sheet is gone, so a Dialog it
        // opens never overlaps this one (two modal layers race over focus and
        // `pointer-events`).
        onCloseAutoFocus={(event) => {
          if (mobile.hasPendingAction()) {
            event.preventDefault();
            mobile.flush();
          }
        }}
      >
        <div role="menu" aria-label={mobile.title} className="grid gap-0.5 p-2">
          {children}
        </div>
      </BottomSheetContent>
    );
  }

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[10rem] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    destructive?: boolean;
  }
>(({ className, destructive, ...props }, ref) => {
  const mobile = React.useContext(MobileMenuContext);

  if (mobile) {
    const { children, disabled, onSelect } = props;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={(event) => {
          // The sheet always closes after a pick, so `preventDefault()` in
          // `onSelect` (keep-open) is not supported on mobile.
          const nativeEvent = event.nativeEvent;
          mobile.select(() => onSelect?.(nativeEvent));
        }}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-base outline-none transition-colors active:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0",
          destructive && "text-destructive active:bg-destructive/10 focus-visible:bg-destructive/10",
          className,
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        destructive && "text-destructive focus:bg-destructive/10 focus:text-destructive",
        className,
      )}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => {
  const mobile = React.useContext(MobileMenuContext);

  if (mobile) {
    return (
      <div
        ref={ref}
        className={cn("px-3 py-2 text-xs font-medium text-muted-foreground", className)}
      >
        {props.children}
      </div>
    );
  }
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => {
  const mobile = React.useContext(MobileMenuContext);

  if (mobile) {
    return (
      <div
        ref={ref}
        role="separator"
        className={cn("my-1 h-px bg-border", className)}
      />
    );
  }
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
});
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
