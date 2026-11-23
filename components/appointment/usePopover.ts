"use client";

import { useCallback, useEffect, useState } from "react";
import type { FocusEvent, KeyboardEvent, RefObject } from "react";

/**
 * Open/close behaviour shared by the date and time pickers: outside click closes,
 * Escape closes and returns focus to the trigger, tabbing out of the field closes.
 * The caller creates the refs, passes them in, and attaches `wrapRef`, `onKeyDown` and `onBlur` to the wrapper that holds input, trigger and popover.
 */
export type PopoverRefs = {
  wrapRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

export function usePopover({ wrapRef, triggerRef }: PopoverRefs) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (e.target instanceof Node && !wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, wrapRef]);

  const close = useCallback((focus: "trigger" | null) => {
    setOpen(false);
    if (focus === "trigger") triggerRef.current?.focus();
  }, [triggerRef]);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    // Same IME guard as Header.tsx and ChatWidget.tsx: Escape cancels a composition, it must not close the popover.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (open && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close("trigger");
    }
  }

  // relatedTarget is null when focus goes to the page background; only a real move outside closes.
  function onBlur(e: FocusEvent<HTMLElement>) {
    const next = e.relatedTarget;
    if (open && next instanceof Node && !wrapRef.current?.contains(next)) setOpen(false);
  }

  return { open, setOpen, close, onKeyDown, onBlur };
}
