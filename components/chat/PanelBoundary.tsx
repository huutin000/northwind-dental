"use client";

import { Component, useEffect, useRef, type ReactNode } from "react";
import { shouldRefocus } from "./helpers";

const BOX =
  "w-[min(24rem,calc(100vw-2*var(--chat-offset)))] rounded-2xl border border-edge bg-canvas p-4 text-sm text-ink shadow-xl";

/** Shown while the lazy chunk is being fetched. */
export function PanelLoading() {
  return (
    <div className={BOX}>
      <p role="status" className="text-muted">
        Loading chat...
      </p>
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
    <div role="dialog" aria-label="Chat" data-testid="chat-panel-error" className={BOX}>
      <p role="alert" className="font-medium">
        Chat could not load.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          ref={retryRef}
          type="button"
          data-testid="chat-retry"
          onClick={onRetry}
          className="min-h-11 rounded-lg bg-brand px-4 text-canvas hover:bg-brand-strong motion-safe:transition-colors"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-lg border border-edge px-4 text-ink hover:bg-tint"
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
