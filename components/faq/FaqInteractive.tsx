"use client";

import { useId, useMemo, useState } from "react";
import { FAQ, FAQ_GROUPS, type FaqEntry } from "@/lib/faq/data";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`size-5 shrink-0 text-brand transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function FaqInteractive() {
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const searchId = useId();

  const toggleItem = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ_GROUPS.map((groupName, groupIndex) => {
      const items = FAQ.filter((item) => {
        if (item.group !== groupName) return false;
        if (!q) return true;
        return (
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q)
        );
      });
      return {
        groupName,
        groupIndex,
        items,
      };
    }).filter((g) => g.items.length > 0);
  }, [query]);

  const totalMatches = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.items.length, 0);
  }, [filteredGroups]);

  return (
    <div className="space-y-8">
      {/* Search Input Bar */}
      <div className="relative max-w-xl mx-auto">
        <label htmlFor={searchId} className="sr-only">
          Search frequently asked questions
        </label>
        <div className="relative flex items-center">
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions (e.g., hours, cleaning, fillings, cost)..."
            className="w-full min-h-12 rounded-2xl border border-edge bg-canvas pl-11 pr-10 text-sm text-ink placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm transition-all"
          />
          <svg
            className="pointer-events-none absolute left-3.5 size-4 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search query"
              className="absolute right-3 inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-tint hover:text-ink text-xs"
            >
              ✕
            </button>
          ) : null}
        </div>

        {query ? (
          <p className="mt-2 text-center text-xs text-muted" aria-live="polite">
            Found {totalMatches} {totalMatches === 1 ? "question" : "questions"} matching &ldquo;{query}&rdquo;
          </p>
        ) : null}
      </div>

      {/* Questions Group List */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-3xl border border-line bg-tint/60 p-8 text-center max-w-lg mx-auto">
          <p className="font-heading text-lg font-semibold text-ink">
            No questions match &ldquo;{query}&rdquo;
          </p>
          <p className="mt-2 text-xs text-muted">
            Try checking spelling or asking a broader term like &ldquo;hours&rdquo;, &ldquo;appointment&rdquo;, or &ldquo;cost&rdquo;. You can also ask our AI assistant below.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-4 inline-flex min-h-10 items-center rounded-full bg-brand px-5 text-xs font-semibold text-canvas hover:bg-brand-strong"
          >
            Show all questions
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {filteredGroups.map(({ groupName, groupIndex, items }) => (
            <section
              key={groupName}
              aria-labelledby={`faq-group-${groupIndex}`}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 border-b border-line pb-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-tint font-heading text-xs font-bold text-brand">
                  0{groupIndex + 1}
                </span>
                <h2
                  id={`faq-group-${groupIndex}`}
                  className="font-heading text-xl sm:text-2xl font-bold text-brand-strong"
                >
                  {groupName}
                </h2>
              </div>

              <div className="space-y-3">
                {items.map((item: FaqEntry) => {
                  const isOpen = openIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-line bg-canvas transition-colors hover:border-edge/60"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggleItem(item.id)}
                        className="flex min-h-12 w-full items-center justify-between gap-4 px-5 py-3.5 text-left font-heading text-sm sm:text-base font-semibold text-ink hover:bg-tint/50 focus-visible:outline-brand transition-colors"
                      >
                        <span className="flex-1">{item.question}</span>
                        <Chevron open={isOpen} />
                      </button>

                      <div
                        className={`accordion-content ${isOpen ? "is-open" : ""}`}
                        aria-hidden={!isOpen}
                      >
                        <div className="accordion-inner">
                          {/* Desktop spacing adjustment to prevent cramped focus ring */}
                          <div className="border-t border-line/60 bg-tint/30 px-5 pt-3 pb-4 text-xs sm:text-sm text-muted leading-relaxed">
                            <p>{item.answer}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
