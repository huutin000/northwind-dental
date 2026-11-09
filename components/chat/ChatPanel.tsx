"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  MAX_INPUT_LENGTH,
  applyFailure,
  buildHistory,
  friendlyError,
  isChatResponse,
  normalizeInput,
  shouldRefocus,
  sourceLabel,
  type ChatMessage,
} from "./helpers";

const REQUEST_TIMEOUT_MS = 20_000;
const COUNTER_FROM = 400;

// Focus the input only if that cannot steal focus from another field on the page.
function canRefocus(el: HTMLElement | null): boolean {
  const root = el?.closest("[data-chat-widget]") ?? null;
  const active = document.activeElement;
  return shouldRefocus({
    activeIsBodyOrNull: active === null || active === document.body,
    activeInsideWidget: root !== null && active !== null && root.contains(active),
  });
}

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  kind: "greeting",
  content:
    "Hi, I'm a demo assistant for Northwind Dental, a fictional clinic. I can help with opening hours, booking, services, costs, preparation and aftercare. Please do not enter real personal details such as a real email address or phone number.",
};

type Props = { open: boolean; onClose: () => void };

export default function ChatPanel({ open, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const unmountedRef = useRef(false);
  // Latest list, so async code can compute the next list without stale closures.
  const messagesRef = useRef<ChatMessage[]>([GREETING]);
  // Set while a send is in flight; consumed when it finishes (focus, caret).
  const afterSendRef = useRef(false);
  const restoredRef = useRef(false);
  const counter = useRef(0);
  const uid = useId();
  const inputId = `${uid}-input`;
  const counterId = `${uid}-count`;

  // Focus the input whenever the panel opens (also on the first mount).
  useEffect(() => {
    if (open && canRefocus(inputRef.current)) inputRef.current?.focus();
  }, [open]);

  // After a send finishes (state is committed): refocus if allowed, and put the
  // caret at the end of text restored after a failed send.
  useEffect(() => {
    if (pending || !afterSendRef.current) return;
    afterSendRef.current = false;
    const el = inputRef.current;
    if (!el) return;
    if (canRefocus(el)) el.focus();
    if (restoredRef.current) {
      restoredRef.current = false;
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [pending]);

  // Abort any request in flight when the panel unmounts.
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      abortRef.current?.abort();
    };
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, open]);

  function commit(next: ChatMessage[]) {
    messagesRef.current = next;
    setMessages(next);
  }

  function nextId() {
    counter.current += 1;
    return `m${counter.current}`;
  }

  async function send() {
    const text = normalizeInput(input);
    if (text === null || pending) return;

    const history = buildHistory(messagesRef.current);
    const userId = nextId();
    commit([
      ...messagesRef.current.filter((m) => m.kind !== "error"),
      { id: userId, role: "user", kind: "turn", content: text },
    ]);
    setInput("");
    afterSendRef.current = true;
    setPending(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      let status = 0;
      let reply: ChatMessage | null = null;
      let serverError: unknown;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history }),
          signal: controller.signal,
        });
        status = res.status;
        const json: unknown = await res.json();
        if (res.status === 200 && isChatResponse(json)) {
          reply = {
            id: nextId(),
            role: "assistant",
            kind: "turn",
            content: json.reply,
            source: json.source,
          };
        } else if (typeof json === "object" && json !== null) {
          serverError = (json as Record<string, unknown>).error;
        }
      } catch {
        // Network error, abort or invalid JSON: a generic failure.
        status = 0;
      }

      if (unmountedRef.current) return;
      if (reply) {
        commit([...messagesRef.current, reply]);
      } else {
        const note: ChatMessage = {
          id: nextId(),
          role: "assistant",
          kind: "error",
          content: friendlyError(status, serverError),
        };
        // Put the typed text back (only into an empty input) and keep the error note.
        const out = applyFailure(messagesRef.current, userId, note, inputRef.current?.value ?? "");
        commit(out.messages);
        if (out.input !== (inputRef.current?.value ?? "")) {
          restoredRef.current = true;
          setInput(out.input);
        }
      }
    } finally {
      clearTimeout(timer);
      if (!unmountedRef.current) setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  const canSend = normalizeInput(input) !== null && !pending;

  return (
    <div
      role="dialog"
      aria-label="Chat with the Northwind Dental demo assistant"
      data-testid="chat-panel"
      className="flex max-h-[min(34rem,70dvh)] w-[min(24rem,calc(100vw-2*var(--chat-offset)))] flex-col overflow-hidden rounded-2xl border border-edge bg-canvas text-ink shadow-xl"
    >
      <div className="flex items-center justify-between gap-2 bg-brand-strong py-1 pl-4 pr-1 text-canvas">
        <p className="font-heading text-base font-semibold">Ask Northwind Dental</p>
        <button
          type="button"
          data-testid="chat-close"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm hover:bg-brand focus-visible:outline-canvas focus-visible:outline-offset-0"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          Close
        </button>
      </div>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation"
        className="flex min-h-40 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden bg-canvas px-3 py-3"
      >
        {messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} data-testid="chat-message-user" className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand px-3 py-2 text-sm text-canvas">
                {m.content}
              </div>
            );
          }
          if (m.kind === "error") {
            return (
              <p key={m.id} data-testid="chat-error" className="max-w-[85%] self-start whitespace-pre-wrap break-words rounded-lg border border-notice-ink bg-notice px-3 py-2 text-sm text-notice-ink">
                {m.content}
              </p>
            );
          }
          const label = m.kind === "turn" ? sourceLabel(m.source) : null;
          return (
            <div
              key={m.id}
              data-testid={m.kind === "greeting" ? "chat-greeting" : "chat-message-assistant"}
              className="max-w-[85%] self-start whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-line bg-tint px-3 py-2 text-sm text-ink"
            >
              {m.content}
              {label ? (
                <span data-testid="chat-source" className="mt-2 block w-fit rounded-full bg-tint-strong px-2 py-0.5 text-xs text-muted">
                  {label}
                </span>
              ) : null}
            </div>
          );
        })}
        {pending ? (
          <p role="status" className="self-start text-sm text-muted">
            Thinking...
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="border-t border-line bg-canvas p-3">
        <label htmlFor={inputId} className="sr-only">
          Your message
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            id={inputId}
            data-testid="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={MAX_INPUT_LENGTH}
            autoComplete="off"
            placeholder="Type your question"
            aria-describedby={input.length >= COUNTER_FROM ? counterId : undefined}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-edge bg-canvas px-3 text-base text-ink placeholder:text-muted"
          />
          <button
            type="submit"
            data-testid="chat-send"
            disabled={!canSend}
            aria-label="Send message"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand text-canvas hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-tint-strong disabled:text-disabled motion-safe:transition-colors"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">
              <path d="M3.4 20.4 21 12 3.4 3.6 3.3 10.1 15 12 3.3 13.9z" />
            </svg>
          </button>
        </div>
        {input.length >= COUNTER_FROM ? (
          <p id={counterId} className="mt-1 text-right text-xs text-muted">
            {input.length} / {MAX_INPUT_LENGTH}
          </p>
        ) : null}
      </form>
    </div>
  );
}
