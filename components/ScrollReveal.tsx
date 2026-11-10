"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  [key: string]: unknown;
};

/**
 * Progressive Enhancement Scroll Reveal.
 * - When JavaScript is disabled: elements remain fully visible (opacity: 1, transform: none).
 * - Above-the-fold elements (already in viewport on mount): remain visible immediately without flickering.
 * - Below-the-fold elements: attach 'js-ready' and animate smoothly when scrolled into view.
 */
export default function ScrollReveal({
  children,
  className = "",
  as: Component = "div",
  ...props
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion preference
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // Check if element is already inside or near the initial viewport
    const rect = el.getBoundingClientRect();
    const isAboveTheFold = rect.top < window.innerHeight;

    if (isAboveTheFold) {
      // Keep it visible immediately: do not hide or flicker
      return;
    }

    // Element is strictly below the fold: prepare for scroll reveal
    el.classList.add("js-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const Element = Component as unknown as React.ElementType;

  return (
    <Element
      ref={ref}
      className={`reveal-on-scroll ${className}`}
      {...props}
    >
      {children}
    </Element>
  );
}
