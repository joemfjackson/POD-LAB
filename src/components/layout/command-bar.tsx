"use client";

import { Command, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { runCommandAction } from "@/server/actions/command";

interface SearchHit {
  kind: string;
  id: string;
  code: string | null;
  title: string;
  subtitle: string | null;
  href: string;
}

const EXAMPLES = [
  "Research 15 HVAC-related niches",
  "Open PL-0001",
  "Run Brand Architect for PL-0001",
  "Show designs awaiting approval",
  "Compare active experiments",
];

/** ⌘K / Ctrl+K command bar. Maps text to a closed set of structured actions. */
export function CommandBar() {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const open = useCallback(() => {
    setMessage(null);
    ref.current?.showModal();
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: SearchHit[] }) => setHits(d.results.slice(0, 8)))
        .catch(() => undefined);
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const visibleHits = q.trim().length >= 2 ? hits : [];

  async function submit(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await runCommandAction(text);
    setBusy(false);
    if (res.ok && res.data?.href) {
      ref.current?.close();
      setQ("");
      router.push(res.data.href);
    } else {
      setMessage(res.ok ? { ok: true, text: res.message ?? "Done" } : { ok: false, text: res.error });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 text-xs text-muted hover:border-line-strong"
        aria-label="Open command bar"
      >
        <Search className="h-3.5 w-3.5" aria-hidden />
        <span className="flex-1 truncate text-left">Search or run a command…</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-line px-1 font-mono text-[10px] sm:inline-flex">
          <Command className="h-2.5 w-2.5" aria-hidden />K
        </kbd>
      </button>
      <dialog
        ref={ref}
        aria-label="Command bar"
        className="m-auto mt-[12vh] w-[min(640px,calc(100vw-2rem))] rounded-lg border border-line-strong bg-surface p-0 text-ink shadow-2xl"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(q);
          }}
          className="border-b border-line"
        >
          <label htmlFor="command-input" className="sr-only">
            Command
          </label>
          <input
            ref={inputRef}
            id="command-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Try "Research 15 HVAC-related niches" or "Open PL-0001"'
            className="h-12 w-full bg-transparent px-4 text-sm outline-none placeholder:text-muted"
            autoComplete="off"
            maxLength={500}
          />
        </form>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {message ? (
            <p role="status" className={`px-2 py-1.5 text-xs ${message.ok ? "text-good-ink" : "text-critical-ink"}`}>
              {message.text}
            </p>
          ) : null}
          {busy ? <p className="px-2 py-1.5 text-xs text-muted">Working…</p> : null}
          {visibleHits.length > 0 ? (
            <ul aria-label="Search results" className="mb-2">
              {visibleHits.map((h) => (
                <li key={`${h.kind}-${h.id}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-2"
                    onClick={() => {
                      ref.current?.close();
                      router.push(h.href);
                    }}
                  >
                    <span className="w-20 shrink-0 text-[10px] text-muted uppercase">{h.kind}</span>
                    {h.code ? <span className="font-mono text-xs text-accent">{h.code}</span> : null}
                    <span className="truncate text-sm">{h.title}</span>
                    {h.subtitle ? <span className="ml-auto truncate text-xs text-muted">{h.subtitle}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="px-2 pt-1 text-[10px] font-semibold tracking-wider text-muted uppercase">Examples</p>
          <ul>
            {EXAMPLES.map((ex) => (
              <li key={ex}>
                <button type="button" className="w-full rounded px-2 py-1.5 text-left text-xs text-ink-2 hover:bg-surface-2" onClick={() => setQ(ex)}>
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
