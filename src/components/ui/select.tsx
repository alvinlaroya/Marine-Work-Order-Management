"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTrigger,
  getControlLabel,
} from "@/components/ui/bottom-sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

const TRIGGER_CLASS =
  "flex h-10 w-full items-center justify-between gap-2 whitespace-nowrap rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors hover:bg-accent/40 data-[placeholder]:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive [&>span]:line-clamp-1 [&>span]:text-left";

/**
 * Set only while the select is rendered as a bottom sheet (mobile). Every part
 * of the select checks it to decide between the Radix select and the sheet.
 */
interface MobileSelectContextValue {
  value: string;
  disabled: boolean;
  onSelect: (value: string) => void;
  /** Element inside the trigger that shows the selected item's label. */
  valueNode: HTMLElement | null;
  setValueNode: (node: HTMLElement | null) => void;
  title: string;
  setTitle: (title: string) => void;
}

const MobileSelectContext = React.createContext<MobileSelectContextValue | null>(null);

/**
 * `"collect"` items only portal their label into the trigger (they are always
 * mounted, so the trigger can show the selected label while the sheet is closed).
 * `"list"` items render the tappable rows inside the open sheet.
 */
const ItemModeContext = React.createContext<"collect" | "list">("collect");

function MobileSelect({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  name,
  children,
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  const [valueState, setValueState] = React.useState(defaultValue);
  const [openState, setOpenState] = React.useState(defaultOpen);
  const [valueNode, setValueNode] = React.useState<HTMLElement | null>(null);
  const [title, setTitle] = React.useState("Select an option");

  const value = valueProp ?? valueState;
  const open = openProp ?? openState;

  const setOpen = React.useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const context = React.useMemo<MobileSelectContextValue>(
    () => ({
      value,
      disabled,
      onSelect: (next) => {
        setValueState(next);
        onValueChange?.(next);
        setOpen(false);
      },
      valueNode,
      setValueNode,
      title,
      setTitle,
    }),
    [value, disabled, onValueChange, setOpen, valueNode, title],
  );

  return (
    <MobileSelectContext.Provider value={context}>
      <BottomSheet open={open} onOpenChange={setOpen}>
        {children}
      </BottomSheet>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </MobileSelectContext.Provider>
  );
}

/** Popover select on desktop; bottom sheet below the `md` breakpoint. */
function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileSelect {...props} /> : <SelectPrimitive.Root {...props} />;
}

function SelectGroup({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Group>) {
  const mobile = React.useContext(MobileSelectContext);
  const mode = React.useContext(ItemModeContext);
  if (mobile) {
    // The always-mounted "collect" pass renders nothing visible; keep it out of the layout.
    return mode === "list" ? <div role="group">{children}</div> : <>{children}</>;
  }
  return <SelectPrimitive.Group {...props}>{children}</SelectPrimitive.Group>;
}

function SelectValue({
  placeholder,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>) {
  const mobile = React.useContext(MobileSelectContext);
  const setValueNode = mobile?.setValueNode;
  // Only collect the selected label when no custom children override it.
  const nodeRef = React.useCallback(
    (node: HTMLSpanElement | null) => setValueNode?.(node),
    [setValueNode],
  );

  if (mobile) {
    const empty = mobile.value === "";
    return (
      <span
        ref={children === undefined ? nodeRef : undefined}
        className={className}
        style={{ pointerEvents: "none" }}
      >
        {empty ? placeholder : children}
      </span>
    );
  }
  return (
    <SelectPrimitive.Value placeholder={placeholder} className={className} {...props}>
      {children}
    </SelectPrimitive.Value>
  );
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, onClick, ...props }, ref) => {
  const mobile = React.useContext(MobileSelectContext);

  if (mobile) {
    return (
      <BottomSheetTrigger
        ref={ref}
        {...(props as React.ComponentPropsWithoutRef<typeof BottomSheetTrigger>)}
        disabled={mobile.disabled || props.disabled}
        data-placeholder={mobile.value === "" ? "" : undefined}
        className={cn(TRIGGER_CLASS, className)}
        onClick={(event) => {
          mobile.setTitle(getControlLabel(event.currentTarget) ?? "Select an option");
          onClick?.(event);
        }}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </BottomSheetTrigger>
    );
  }

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(TRIGGER_CLASS, className)}
      onClick={onClick}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

function focusOption(list: HTMLElement, target: "next" | "previous" | "first" | "last") {
  const options = Array.from(
    list.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)'),
  );
  if (options.length === 0) {
    return;
  }
  const current = options.indexOf(document.activeElement as HTMLButtonElement);
  const index =
    target === "first"
      ? 0
      : target === "last"
        ? options.length - 1
        : target === "next"
          ? Math.min(current + 1, options.length - 1)
          : Math.max(current - 1, 0);
  options[index]?.focus();
}

function MobileSelectContent({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const mobile = React.useContext(MobileSelectContext);
  const listRef = React.useRef<HTMLDivElement>(null);

  if (!mobile) {
    return null;
  }
  return (
    <>
      <ItemModeContext.Provider value="collect">{children}</ItemModeContext.Provider>
      <BottomSheetContent
        title={title ?? mobile.title}
        onOpenAutoFocus={(event) => {
          // Land on the current choice, centred, so it is visible in long lists.
          const selected = listRef.current?.querySelector<HTMLElement>(
            '[aria-selected="true"]',
          );
          if (selected) {
            event.preventDefault();
            selected.focus({ preventScroll: true });
            selected.scrollIntoView({ block: "center" });
          }
        }}
      >
        <div
          ref={listRef}
          role="listbox"
          aria-label={title ?? mobile.title}
          className="grid gap-0.5 p-2"
          onKeyDown={(event) => {
            const keys = {
              ArrowDown: "next",
              ArrowUp: "previous",
              Home: "first",
              End: "last",
            } as const;
            const target = keys[event.key as keyof typeof keys];
            if (target && listRef.current) {
              event.preventDefault();
              focusOption(listRef.current, target);
            }
          }}
        >
          <ItemModeContext.Provider value="list">{children}</ItemModeContext.Provider>
        </div>
      </BottomSheetContent>
    </>
  );
}

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", title, ...props }, ref) => {
  const mobile = React.useContext(MobileSelectContext);

  if (mobile) {
    return <MobileSelectContent title={title}>{children}</MobileSelectContent>;
  }

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[8rem] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
          <ChevronUp className="h-4 w-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
          <ChevronDown className="h-4 w-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
    /** Secondary line shown under the item in the list (not in the trigger). */
    description?: React.ReactNode;
  }
>(({ className, children, description, ...props }, ref) => {
  const mobile = React.useContext(MobileSelectContext);
  const mode = React.useContext(ItemModeContext);

  if (mobile) {
    const selected = mobile.value === props.value;

    if (mode === "collect") {
      // Mirror Radix: show the selected item's label inside the trigger.
      return selected && mobile.valueNode
        ? createPortal(children, mobile.valueNode)
        : null;
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        role="option"
        aria-selected={selected}
        disabled={props.disabled}
        onClick={() => mobile.onSelect(props.value)}
        className={cn(
          "relative flex min-h-12 w-full items-center rounded-lg py-2 pl-3 pr-10 text-left text-base outline-none transition-colors active:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50",
          selected && "bg-accent/60 font-medium",
          className,
        )}
      >
        <span className="absolute right-3 flex size-5 items-center justify-center">
          {selected ? <Check className="size-5 text-primary" /> : null}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span>{children}</span>
          {description ? (
            <span className="text-sm font-normal text-muted-foreground">{description}</span>
          ) : null}
        </span>
      </button>
    );
  }

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </div>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
};
