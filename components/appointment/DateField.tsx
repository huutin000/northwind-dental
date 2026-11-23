"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import {
  MONTH_NAMES,
  WEEKDAY_HEADERS,
  addDays,
  addMonths,
  formatDate,
  longDateLabel,
  monthGrid,
  parseDateInput,
  parseIso,
  todayIso,
} from "./dateTime";
import { usePopover } from "./usePopover";

type Props = {
  id: string;
  /** ISO "YYYY-MM-DD" or "". */
  value: string;
  onChange: (iso: string) => void;
  /** Same classes as the other inputs, border included (the parent owns the error border). */
  inputClassName: string;
  invalid?: boolean;
  describedBy?: string;
};

const iconButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-tint hover:text-ink disabled:cursor-not-allowed";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "M14.5 6l-6 6 6 6" : "M9.5 6l6 6-6 6"} />
    </svg>
  );
}

/** Text input plus a calendar popover. The value is ISO or ""; the text shows "Dec 3, 2026". */
export default function DateField({ id, value, onChange, inputClassName, invalid, describedBy }: Props) {
  const [text, setText] = useState(() => formatDate(value));
  const [syncedValue, setSyncedValue] = useState(value);
  // The value changed from outside (a calendar pick, the form reset): show it, unless the typed text already means it.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if ((parseDateInput(text) ?? "") !== value) setText(formatDate(value));
  }

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pop = usePopover({ wrapRef, triggerRef });
  const [cursor, setCursor] = useState("");
  const [today, setToday] = useState("");
  const focusPending = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const dialogId = `${id}-dialog`;
  const valueId = `${id}-value`;
  const hasValue = parseIso(value) !== null;

  useEffect(() => {
    if (!pop.open || !focusPending.current) return;
    focusPending.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${cursor}"]`)?.focus();
  }, [pop.open, cursor]);

  function onTextChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setText(next);
    const parsed = parseDateInput(next);
    onChange(parsed ?? "");
    if (parsed && pop.open) setCursor(parsed);
  }

  function onTextBlur() {
    const parsed = parseDateInput(text);
    if (parsed) setText(formatDate(parsed));
  }

  function toggle() {
    if (pop.open) {
      pop.setOpen(false);
      return;
    }
    const now = todayIso();
    setToday(now);
    setCursor(parseIso(value) ? value : now);
    focusPending.current = true;
    pop.setOpen(true);
  }

  function moveCursor(next: string) {
    focusPending.current = true;
    setCursor(next);
  }

  function onDayKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const steps: Record<string, string> = {
      ArrowLeft: addDays(cursor, -1),
      ArrowRight: addDays(cursor, 1),
      ArrowUp: addDays(cursor, -7),
      ArrowDown: addDays(cursor, 7),
      PageUp: addMonths(cursor, -1),
      PageDown: addMonths(cursor, 1),
    };
    const next = steps[e.key];
    if (next === undefined) return;
    e.preventDefault();
    moveCursor(next);
  }

  function pick(iso: string) {
    onChange(iso);
    pop.close("trigger");
  }

  const view = pop.open ? parseIso(cursor) : null;
  const monthTitle = view ? `${MONTH_NAMES[view.m - 1]} ${view.y}` : "";

  return (
    <div ref={wrapRef} className="relative mt-2" onKeyDown={pop.onKeyDown} onBlur={pop.onBlur}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder="e.g. Dec 3, 2026"
        required
        value={text}
        onChange={onTextChange}
        onBlur={onTextBlur}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={`${inputClassName} pr-14`}
      />
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open calendar"
        aria-haspopup="dialog"
        aria-expanded={pop.open}
        aria-controls={dialogId}
        aria-describedby={hasValue ? valueId : undefined}
        onClick={toggle}
        className={`${iconButton} absolute right-0.5 top-1/2 -translate-y-1/2`}
      >
        <CalendarIcon />
      </button>
      {hasValue ? (
        <span id={valueId} className="sr-only">
          Selected date: {longDateLabel(value)}
        </span>
      ) : null}
      <div
        id={dialogId}
        role="dialog"
        aria-label="Calendar"
        tabIndex={-1}
        hidden={!pop.open}
        className="absolute left-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-card border border-edge bg-surface p-2 shadow-lift"
      >
        {view ? (
          <>
            <div className="mb-1 flex items-center justify-between">
              <button type="button" aria-label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))} className={iconButton}>
                <Chevron direction="left" />
              </button>
              <div aria-live="polite" className="font-heading text-lg text-ink">
                {monthTitle}
              </div>
              <button type="button" aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))} className={iconButton}>
                <Chevron direction="right" />
              </button>
            </div>
            <div aria-hidden="true" className="grid grid-cols-7 gap-1 pb-1 text-center text-sm text-muted">
              {WEEKDAY_HEADERS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div ref={gridRef} role="group" aria-label={monthTitle} className="grid grid-cols-7 gap-1">
              {monthGrid(view.y, view.m).map((day) => {
                const selected = day.iso === value;
                const isToday = day.iso === today;
                const tone = selected
                  ? "bg-brand font-semibold text-canvas hover:bg-brand-strong"
                  : `${day.inMonth ? "text-ink" : "text-muted"} hover:bg-tint`;
                return (
                  <button
                    key={day.iso}
                    type="button"
                    data-iso={day.iso}
                    aria-label={longDateLabel(day.iso)}
                    aria-pressed={selected}
                    aria-current={isToday ? "date" : undefined}
                    tabIndex={day.iso === cursor ? 0 : -1}
                    onClick={() => pick(day.iso)}
                    onKeyDown={onDayKeyDown}
                    className={`relative min-h-10 rounded-control text-[0.9375rem] tabular-nums ${tone} ${isToday ? "font-semibold" : ""}`}
                  >
                    {day.d}
                    {isToday ? (
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${selected ? "bg-canvas" : "bg-brand"}`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
