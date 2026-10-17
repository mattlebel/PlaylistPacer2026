"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";

export function Marquee({ items, className = "" }: { items: string[]; className?: string }) {
  const row = items.join("  ✦  ") + "  ✦  ";
  return (
    <div className={`overflow-hidden whitespace-nowrap border-b border-paper/10 ${className}`} aria-hidden>
      <div className="inline-block animate-marquee py-1.5 font-display text-[11px] font-bold uppercase tracking-wider">
        <span>{row}</span>
        <span>{row}</span>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  accent = "var(--color-acid)",
  wide = false,
}: {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
  accent?: string;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            className={`panel relative max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-[26px] sm:p-7 ${wide ? "max-w-4xl" : "max-w-2xl"}`}
            style={{ borderColor: accent }}
            initial={{ y: 40, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="font-display text-2xl font-black uppercase leading-none sm:text-3xl">{title}</h2>
              <button
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-paper/20 text-xl transition hover:border-paper/60"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  label,
}: {
  value: T;
  options: { value: NoInfer<T>; label: ReactNode; title?: string; disabled?: boolean }[];
  onChange(v: NoInfer<T>): void;
  size?: "sm" | "md";
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full border-2 border-paper/15 bg-ink p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            title={o.title}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`relative rounded-full font-bold transition disabled:cursor-not-allowed disabled:opacity-30 ${
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
            } ${on ? "text-ink" : "text-paper/70 hover:text-paper"}`}
          >
            {on && (
              <motion.span
                layoutId={`seg-${label}`}
                className="absolute inset-0 rounded-full bg-acid"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  tabs,
  onChange,
}: {
  value: T;
  tabs: { value: NoInfer<T>; label: string; emoji: string }[];
  onChange(v: NoInfer<T>): void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`rounded-full border-2 px-4 py-2 font-display text-xs font-extrabold uppercase transition ${
            value === t.value
              ? "border-black bg-paper text-ink"
              : "border-paper/15 text-paper/70 hover:border-paper/40 hover:text-paper"
          }`}
        >
          <span className="mr-1.5">{t.emoji}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone(): void }) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDone, 4200);
    return () => clearTimeout(id);
  }, [message, onDone]);
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          className="stk fixed bottom-5 left-1/2 z-[70] max-w-[92vw] -translate-x-1/2 bg-sun px-5 py-3 font-bold"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
