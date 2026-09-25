"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";

/** Accessible modal using the native <dialog> element (focus trap + Esc built in). */
export function Dialog({ trigger, title, children, triggerVariant = "primary", triggerSize = "md", defaultOpen = false }: { trigger: string; title: string; children: ReactNode; triggerVariant?: "primary" | "secondary" | "ghost" | "danger"; triggerSize?: "sm" | "md"; defaultOpen?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (defaultOpen && !ref.current?.open) ref.current?.showModal();
  }, [defaultOpen]);
  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => ref.current?.showModal()}>
        {trigger}
      </Button>
      <dialog
        ref={ref}
        aria-label={title}
        className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-lg border border-line-strong bg-surface p-0 text-ink shadow-2xl"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={() => ref.current?.close()} aria-label="Close dialog">
            ✕
          </Button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
      </dialog>
    </>
  );
}
