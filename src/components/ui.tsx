"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  accent = "var(--color-pink)",
  wide = false,
  narrow = false,
  heading,
  dismissable = true,
}: {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
  accent?: string;
  wide?: boolean;
  narrow?: boolean;
  /** Shown in place of the plain title (which still names the dialog for screen readers). */
  heading?: ReactNode;
  /** false: no ✕, and Escape or a tap outside doesn't close it (the popup needs an answer first). */
  dismissable?: boolean;
}) {
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissable]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => dismissable && e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[22px] bg-ink-2 p-5 shadow-[0_30px_80px_rgb(8_10_40/0.5)] sm:rounded-[22px] sm:p-7 ${wide ? "max-w-4xl" : narrow ? "max-w-xl" : "max-w-2xl"}`}
            style={{ boxShadow: `inset 0 3px 0 ${accent}, 0 30px 80px rgb(8 10 40 / 0.5)` }}
            initial={{ y: 40, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            <div className="mb-4 flex min-h-10 items-center justify-between gap-4 sm:mb-5">
              {heading ?? <h2 className="font-display text-2xl font-bold leading-none tracking-tight sm:text-3xl">{title}</h2>}
              {dismissable && (
                <button
                  onClick={onClose}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-pink/30 text-lg transition hover:border-pink"
                  aria-label="Close"
                >
                  ✕
                </button>
              )}
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
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full bg-ink-3 p-1">
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
            } ${on ? "text-ink" : "text-pink/70 hover:text-pink"}`}
          >
            {on && (
              <motion.span
                layoutId={`seg-${label}`}
                className="absolute inset-0 rounded-full bg-pink"
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
  tabs: { value: NoInfer<T>; label: string }[];
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
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            value === t.value
              ? "border-pink bg-pink text-ink"
              : "border-pink/30 text-pink/80 hover:border-pink hover:text-pink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({
  message,
  onDone,
  actions,
}: {
  message: string | null;
  onDone(): void;
  /** Optional buttons, e.g. "Share" and "Undo". */
  actions?: { label: string; onClick(): void }[] | null;
}) {
  const has = !!actions?.length;
  // Keep the latest onDone in a ref: pages re-render often (live updates), and restarting the timer on
  // every render would keep the message up forever.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => done.current(), has ? 4500 : 4200);
    return () => clearTimeout(id);
  }, [message, has]);
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          className="stk fixed bottom-5 left-1/2 z-[70] max-w-[92vw] -translate-x-1/2 bg-pink px-5 py-3 font-semibold"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
        >
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>{message}</span>
            {actions?.map((a) => (
              <button key={a.label} className="btn bg-ink px-4 py-1.5 text-xs text-pink" onClick={a.onClick}>
                {a.label}
              </button>
            ))}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
