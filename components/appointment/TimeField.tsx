"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { FIRST_HOUR, LAST_HOUR, MINUTE_STEPS, isMinuteAllowed, joinTime, parseTimeInput, splitTime } from "./dateTime";
import { usePopover } from "./usePopover";

type Props = {
  id: string;
  /** "HH:MM" (24-hour) or "". */
  value: string;
  onChange: (time: string) => void;
  /** Same classes as the other inputs, border included (the parent owns the error border). */
  inputClassName: string;
  invalid?: boolean;
  describedBy?: string;
};

const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
const HOUR_COLUMNS = 3;

const iconButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-tint hover:text-ink";
const optionBase = "min-h-11 rounded-control text-base tabular-nums disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60";

const pad2 = (n: number) => String(n).padStart(2, "0");

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

/** Text input plus an hour and minute popover (24-hour, clinic hours). The value is "HH:MM" or "". */
export default function TimeField({ id, value, onChange, inputClassName, invalid, describedBy }: Props) {
  const [text, setText] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  // The value changed from outside (a popover pick, the form reset): show it, unless the typed text already means it.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if ((parseTimeInput(text) ?? "") !== value) setText(value);
  }

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pop = usePopover({ wrapRef, triggerRef });
  const dialogRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);
  const [hourFocus, setHourFocus] = useState(FIRST_HOUR);
  const [minuteFocus, setMinuteFocus] = useState(0);
  const dialogId = `${id}-dialog`;
  const valueId = `${id}-value`;
  const parts = splitTime(value);

  useEffect(() => {
    if (!pop.open || !focusPending.current) return;
    focusPending.current = false;
    dialogRef.current?.querySelector<HTMLButtonElement>(`[data-hour="${hourFocus}"]`)?.focus();
  }, [pop.open, hourFocus]);

  function onTextChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setText(next);
    onChange(parseTimeInput(next) ?? "");
  }

  function onTextBlur() {
    const parsed = parseTimeInput(text);
    if (parsed) setText(parsed);
  }

  function toggle() {
    if (pop.open) {
      pop.setOpen(false);
      return;
    }
    const hour = parts?.hour ?? FIRST_HOUR;
    const minute = parts?.minute ?? 0;
    setHourFocus(hour >= FIRST_HOUR && hour <= LAST_HOUR ? hour : FIRST_HOUR);
    setMinuteFocus(MINUTE_STEPS.some((m) => m === minute) ? minute : 0);
    focusPending.current = true;
    pop.setOpen(true);
  }

  function pickHour(hour: number) {
    const current = parts?.minute ?? 0;
    const keep = MINUTE_STEPS.some((m) => m === current) && isMinuteAllowed(hour, current);
    onChange(joinTime(hour, keep ? current : 0));
  }

  function pickMinute(minute: number) {
    if (parts === null) return;
    onChange(joinTime(parts.hour, minute));
    pop.close("trigger");
  }

  function focusButton(selector: string) {
    dialogRef.current?.querySelector<HTMLButtonElement>(selector)?.focus();
  }

  function onHourKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -HOUR_COLUMNS, ArrowDown: HOUR_COLUMNS };
    let target: number | undefined;
    if (e.key === "Home") target = FIRST_HOUR;
    else if (e.key === "End") target = LAST_HOUR;
    else if (e.key in deltas) target = hourFocus + deltas[e.key];
    if (target === undefined) return;
    e.preventDefault();
    if (target >= FIRST_HOUR && target <= LAST_HOUR) focusButton(`[data-hour="${target}"]`);
  }

  // At hour 17 only :00 is selectable, so the keyboard walks the minutes that can be chosen.
  const allowedMinutes = parts === null ? [] : MINUTE_STEPS.filter((m) => isMinuteAllowed(parts.hour, m));
  const minuteStop = allowedMinutes.includes(minuteFocus) ? minuteFocus : allowedMinutes[0];

  function onMinuteKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const index = allowedMinutes.indexOf(minuteFocus);
    let target: number | undefined;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") target = allowedMinutes[index - 1];
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") target = allowedMinutes[index + 1];
    else if (e.key === "Home") target = allowedMinutes[0];
    else if (e.key === "End") target = allowedMinutes[allowedMinutes.length - 1];
    else return;
    e.preventDefault();
    if (target !== undefined) focusButton(`[data-minute="${target}"]`);
  }

  return (
    <div ref={wrapRef} className="relative mt-2" onKeyDown={pop.onKeyDown} onBlur={pop.onBlur}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder="e.g. 10:30"
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
        aria-label="Open time picker"
        aria-haspopup="dialog"
        aria-expanded={pop.open}
        aria-controls={dialogId}
        aria-describedby={parts !== null ? valueId : undefined}
        onClick={toggle}
        className={`${iconButton} absolute right-0.5 top-1/2 -translate-y-1/2`}
      >
        <ClockIcon />
      </button>
      {parts !== null ? (
        <span id={valueId} className="sr-only">
          Selected time: {value}
        </span>
      ) : null}
      <div
        id={dialogId}
        ref={dialogRef}
        role="dialog"
        aria-label="Time picker"
        tabIndex={-1}
        hidden={!pop.open}
        className="absolute left-0 top-full z-20 mt-2 w-[min(17rem,calc(100vw-3rem))] rounded-card border border-edge bg-surface p-3 shadow-lift sm:left-auto sm:right-0"
      >
        {pop.open ? (
          <>
            <p id={`${id}-hour-label`} className="mb-1.5 text-sm text-muted">
              Hour
            </p>
            <div role="group" aria-labelledby={`${id}-hour-label`} className="grid grid-cols-3 gap-1">
              {HOURS.map((hour) => {
                const selected = parts?.hour === hour;
                return (
                  <button
                    key={hour}
                    type="button"
                    data-hour={hour}
                    aria-label={`Hour ${pad2(hour)}`}
                    aria-pressed={selected}
                    tabIndex={hour === hourFocus ? 0 : -1}
                    onFocus={() => setHourFocus(hour)}
                    onClick={() => pickHour(hour)}
                    onKeyDown={onHourKeyDown}
                    className={`${optionBase} ${selected ? "bg-brand font-semibold text-canvas hover:bg-brand-strong" : "text-ink hover:bg-tint"}`}
                  >
                    {pad2(hour)}
                  </button>
                );
              })}
            </div>
            <p id={`${id}-minute-label`} className="mb-1.5 mt-3 text-sm text-muted">
              Minute
            </p>
            <div role="group" aria-labelledby={`${id}-minute-label`} className="grid grid-cols-4 gap-1">
              {MINUTE_STEPS.map((minute) => {
                const selected = parts?.minute === minute;
                const allowed = allowedMinutes.includes(minute);
                return (
                  <button
                    key={minute}
                    type="button"
                    data-minute={minute}
                    aria-label={`Minute ${pad2(minute)}`}
                    aria-pressed={selected}
                    disabled={!allowed}
                    tabIndex={minute === minuteStop ? 0 : -1}
                    onFocus={() => setMinuteFocus(minute)}
                    onClick={() => pickMinute(minute)}
                    onKeyDown={onMinuteKeyDown}
                    className={`${optionBase} ${selected ? "bg-brand font-semibold text-canvas hover:bg-brand-strong" : "text-ink hover:bg-tint"}`}
                  >
                    {pad2(minute)}
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
