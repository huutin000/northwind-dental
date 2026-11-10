"use client";

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import PanelBoundary, { PanelLoading } from "./chat/PanelBoundary";
import { shouldCloseOnEscape } from "./chat/helpers";

// Only this file (the toggle, the boundary and their state) ships in the initial
// bundle. The chat UI is a separate chunk that is fetched on the first open.
const loadPanel = () => import("./chat/ChatPanel");

const PANEL_ID = "chat-panel-region";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  // Not mounted (and its chunk not fetched) before the first open. After that the
  // same panel instance stays mounted (hidden when closed), so the in-memory
  // conversation survives close and reopen and client-side navigation.
  const [everOpened, setEverOpened] = useState(false);
  // React.lazy caches a rejected import() forever. Only retry() creates a
  // brand-new lazy component (a new import() call) and remounts the boundary
  // through a new key; that is the only remount, and it resets the conversation.
  // Consequence: after a load or render failure, closing and reopening shows the
  // same failure box until "Try again" is pressed. Creating lazy() does not fetch
  // anything until it renders.
  const [attempt, setAttempt] = useState(0);
  const [Panel, setPanel] = useState(() => lazy(loadPanel));
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  // Following the contact link: hide the panel but do not pull focus to the toggle,
  // so the destination page controls focus and scroll.
  const closeForNavigation = useCallback(() => setOpen(false), []);

  const retry = useCallback(() => {
    setPanel(() => lazy(loadPanel));
    setAttempt((n) => n + 1);
  }, []);

  function toggle() {
    if (open) {
      close();
    } else {
      setEverOpened(true);
      setOpen(true);
    }
  }

  // M4: Escape closes the panel only when focus is inside the widget (non-modal dialog),
  // ignoring keyCode === 229 for Safari IME composition.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.keyCode === 229) return;
      const root = rootRef.current;
      const active = document.activeElement;
      if (
        shouldCloseOnEscape({
          focusInsideWidget: root !== null && active !== null && root.contains(active),
          defaultPrevented: event.defaultPrevented,
          isComposing: event.isComposing,
        })
      ) {
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // aria-expanded mirrors the open state. While the chunk loads or failed, the
  // region still shows a visible loading or error dialog, so the expanded claim
  // always points at something real on screen.
  return (
    <div ref={rootRef} data-chat-widget="">
      <div
        id={PANEL_ID}
        hidden={!open}
        className="fixed right-[max(var(--chat-offset),env(safe-area-inset-right))] bottom-[calc(var(--chat-bottom)+var(--chat-size)+0.75rem)] z-(--chat-z)"
      >
        {everOpened ? (
          <PanelBoundary key={attempt} onRetry={retry} onClose={close}>
            <Suspense fallback={<PanelLoading />}>
              <Panel open={open} onClose={close} onNavigate={closeForNavigation} />
            </Suspense>
          </PanelBoundary>
        ) : null}
      </div>
      <button
        ref={toggleRef}
        type="button"
        data-testid="chat-toggle"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? "Close chat" : "Open chat with Northwind Dental"}
        onClick={toggle}
        className="fixed right-[max(var(--chat-offset),env(safe-area-inset-right))] bottom-(--chat-bottom) z-(--chat-z) flex size-(--chat-size) items-center justify-center rounded-full bg-brand text-canvas shadow-toggle hover:bg-brand-strong motion-safe:hover:scale-105 motion-safe:active:scale-95 motion-safe:transition-all"
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M5 3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6.2l-4.4 3.9A.8.8 0 0 1 7 20.3V17H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
          </svg>
        )}
      </button>
    </div>
  );
}
