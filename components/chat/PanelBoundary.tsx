"use client";

import { Component, useEffect, useRef, type ReactNode } from "react";
import { shouldRefocus } from "./helpers";

const BOX =
  "w-[min(24.5rem,calc(100vw-2*var(--chat-offset)))] rounded-panel border border-line bg-surface p-5 text-[0.9375rem] text-ink shadow-panel";

/** Shown while the lazy chunk is being fetched. */
export function PanelLoading() {
  const loadingRef = useRef<HTMLDivElement>(null);

  // M3: Move focus to the loading container when mounting so focus is not lost to body
  useEffect(() => {
    const el = loadingRef.current;
    if (!el) return;
    const active = document.activeElement;
    const root = el.closest("[data-chat-widget]");
    if (
      shouldRefocus({
        activeIsBodyOrNull: active === null || active === document.body,
        activeInsideWidget: root !== null && active !== null && root.contains(active),
      })
    ) {
      el.focus();
    }
  }, []);

  return (
    <div
      ref={loadingRef}
      tabIndex={-1}
      className={BOX}
    >
      <div className="flex items-center gap-2 text-muted">
        <svg
          className="h-4 w-4 animate-spin text-brand motion-reduce:hidden"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p role="status">Loading chat...</p>
      </div>
    </div>
  );
}

function PanelFailed({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  const retryRef = useRef<HTMLButtonElement>(null);

  // Move focus to the retry button unless the visitor is typing elsewhere on the page.
  useEffect(() => {
    const el = retryRef.current;
    if (!el) return;
    const root = el.closest("[data-chat-widget]");
    const active = document.activeElement;
    if (
      shouldRefocus({
        activeIsBodyOrNull: active === null || active === document.body,
        activeInsideWidget: root !== null && active !== null && root.contains(active),
      })
    ) {
      el.focus();
    }
  }, []);

  return (
    <div
      role="dialog"
      aria-label="Chat"
      aria-describedby="chat-boundary-error-msg"
      data-testid="chat-panel-error"
      className={BOX}
    >
      {/* M1 & M5: Dropped role="alert", added aria-describedby and friendly text */}
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-error text-error-ink" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </span>
        <p id="chat-boundary-error-msg" className="font-heading text-lg text-ink">
          Chat is unavailable right now.
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          ref={retryRef}
          type="button"
          data-testid="chat-retry"
          onClick={onRetry}
          className="min-h-11 rounded-button bg-brand px-5 font-semibold text-canvas hover:bg-brand-strong motion-safe:transition-colors"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-button border border-edge px-5 font-semibold text-ink hover:bg-tint"
        >
          Close
        </button>
      </div>
    </div>
  );
}

type Props = { children: ReactNode; onRetry: () => void; onClose: () => void };

/**
 * Catches a rejected lazy import or a render error of the panel, so only the
 * panel area is replaced and the rest of the page keeps working.
 * Reset happens by remounting this boundary with a new `key` (see ChatWidget).
 */
export default class PanelBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <PanelFailed onRetry={this.props.onRetry} onClose={this.props.onClose} />;
    }
    return this.props.children;
  }
}
