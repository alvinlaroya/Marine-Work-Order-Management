"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import * as React from "react";

import { BottomSheet, BottomSheetContent } from "@/components/ui/bottom-sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  /** Plain text used for the search match and as the accessible name. */
  label: string;
  /** Optional extra content rendered after the label (e.g. badges). */
  trailing?: React.ReactNode;
  /** Optional secondary text; shown under the label in the list and searchable. */
  description?: string;
}

interface ComboboxProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  /** Extra classes for the trigger button (e.g. to highlight it). */
  triggerClassName?: string;
  /** Accessible name for the trigger when there is no associated <label>. */
  ariaLabel?: string;
  /** Show each option's description next to the selected value in the trigger. Defaults to true. */
  triggerShowsDescription?: boolean;
  /**
   * Render the list as an absolutely positioned popover under the trigger instead of
   * inline. Use outside dialogs, e.g. in a sticky header, where growing the layout is wrong.
   */
  floating?: boolean;
  /** Controlled open state. Leave undefined for an uncontrolled combobox. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Heading of the bottom sheet on mobile. Defaults to `ariaLabel`, then `placeholder`. */
  sheetTitle?: string;
}

/**
 * Searchable select. On desktop the option list opens inline (in normal flow)
 * rather than as a floating popover so it is never clipped by a scrolling
 * dialog. Below the `md` breakpoint it opens in a bottom sheet instead.
 */
export function Combobox({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  disabled = false,
  invalid = false,
  className,
  triggerClassName,
  ariaLabel,
  triggerShowsDescription = true,
  floating = false,
  open: openProp,
  onOpenChange,
  sheetTitle,
}: ComboboxProps) {
  const isMobile = useIsMobile();
  const listId = React.useId();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = React.useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const selected = options.find((option) => option.value === value);

  const filtered = React.useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return options;
    }
    return options.filter((option) => {
      const haystack = `${option.label} ${option.description ?? ""}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [options, query]);

  const active = Math.min(activeIndex, filtered.length - 1);

  const openList = () => {
    if (disabled) {
      return;
    }
    const selectedIndex = options.findIndex((option) => option.value === value);
    setQuery("");
    setActiveIndex(Math.max(selectedIndex, 0));
    setOpen(true);
  };

  const closeList = (restoreFocus: boolean) => {
    setOpen(false);
    // The sheet returns focus itself once it has closed.
    if (restoreFocus && !isMobile) {
      triggerRef.current?.focus();
    }
  };

  const choose = (option: ComboboxOption) => {
    onValueChange(option.value);
    closeList(true);
  };

  // Focus the search box when the list opens. On mobile that would pop the
  // keyboard over the sheet, so the sheet focuses itself instead.
  React.useEffect(() => {
    if (open && !isMobile) {
      inputRef.current?.focus();
    }
  }, [open, isMobile]);

  // Close when clicking elsewhere. The mobile sheet is portaled out of the
  // container and has its own overlay, so it handles this itself.
  React.useEffect(() => {
    if (!open || isMobile) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, isMobile, setOpen]);

  // Keep the highlighted option visible while navigating with the keyboard.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (filtered.length > 0) {
          setActiveIndex((active + 1) % filtered.length);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (filtered.length > 0) {
          setActiveIndex((active - 1 + filtered.length) % filtered.length);
        }
        break;
      case "Enter":
        // Never submit the surrounding form from the search box.
        event.preventDefault();
        if (filtered[active]) {
          choose(filtered[active]);
        }
        break;
      case "Escape":
        // Close the list only; don't let the parent dialog close too.
        event.preventDefault();
        event.stopPropagation();
        closeList(true);
        break;
      case "Tab":
        // In the sheet, focus is trapped and Tab just moves between its controls.
        if (!isMobile) {
          setOpen(false);
        }
        break;
    }
  };

  const searchBox = (
    <div
      className={cn(
        "flex items-center gap-2 border-b px-3",
        isMobile && "sticky top-0 z-10 bg-popover px-4",
      )}
    >
      <Search className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        role="searchbox"
        autoComplete="off"
        aria-label={searchPlaceholder}
        aria-controls={listId}
        aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
        value={query}
        placeholder={searchPlaceholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={onSearchKeyDown}
        // 16px on mobile keeps iOS Safari from zooming the page on focus.
        className={cn(
          "w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground",
          isMobile ? "h-12 text-base" : "h-10",
        )}
      />
    </div>
  );

  const optionList = (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      className={cn(isMobile ? "p-2" : "max-h-48 overflow-y-auto p-1")}
      // The parent dialog locks page scroll; keep wheel events for this list.
      onWheel={(event) => event.stopPropagation()}
    >
      {filtered.length === 0 ? (
        <li
          className={cn(
            "px-2 py-3 text-center text-sm text-muted-foreground",
            isMobile && "py-6",
          )}
        >
          {emptyText}
        </li>
      ) : (
        filtered.map((option, index) => (
          <li
            key={option.value}
            id={`${listId}-${index}`}
            data-index={index}
            role="option"
            aria-selected={option.value === value}
            onMouseEnter={() => setActiveIndex(index)}
            // Prevent the search input from losing focus before the click lands.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
            className={cn(
              "relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-sm",
              isMobile && "min-h-12 scroll-mt-14 rounded-lg py-2 pl-3 pr-10 text-base",
              index === active && "bg-accent text-accent-foreground",
            )}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate">{option.label}</span>
              {option.description ? (
                <span
                  className={cn(
                    "truncate text-xs text-muted-foreground",
                    isMobile && "text-sm",
                  )}
                >
                  {option.description}
                </span>
              ) : null}
            </span>
            {option.trailing}
            {option.value === value ? (
              <Check
                className={cn("absolute right-2 h-4 w-4", isMobile && "right-3 size-5 text-primary")}
                aria-hidden
              />
            ) : null}
          </li>
        ))
      )}
    </ul>
  );

  return (
    <div ref={containerRef} className={cn("space-y-1.5", floating && "relative", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid}
        aria-label={ariaLabel}
        disabled={disabled}
        data-placeholder={selected ? undefined : ""}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openList();
          }
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 whitespace-nowrap rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors hover:bg-accent/40 data-[placeholder]:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
          triggerClassName,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-left">
          {selected ? (
            <>
              <span className="truncate">
                {selected.label}
                {selected.description && triggerShowsDescription ? (
                  <span className="text-muted-foreground">
                    {" · "}
                    {selected.description}
                  </span>
                ) : null}
              </span>
              {selected.trailing}
            </>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && !isMobile ? (
        <div
          className={cn(
            "overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-sm",
            floating && "absolute inset-x-0 top-full z-50 mt-1 shadow-md",
          )}
        >
          {searchBox}
          {optionList}
        </div>
      ) : null}

      {isMobile ? (
        <BottomSheet open={open} onOpenChange={setOpen}>
          <BottomSheetContent
            title={sheetTitle ?? ariaLabel ?? placeholder}
            onOpenAutoFocus={(event) => {
              // Bring the current choice into view without raising the keyboard.
              event.preventDefault();
              (event.currentTarget as HTMLElement).focus({ preventScroll: true });
              listRef.current
                ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
                ?.scrollIntoView({ block: "center" });
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              triggerRef.current?.focus({ preventScroll: true });
            }}
          >
            {searchBox}
            {optionList}
          </BottomSheetContent>
        </BottomSheet>
      ) : null}
    </div>
  );
}
