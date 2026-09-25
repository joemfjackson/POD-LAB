"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav({ pendingApprovals }: { pendingApprovals: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="mobile-nav"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <div id="mobile-nav" className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r border-line bg-surface p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">POD Lab</span>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-md hover:bg-surface-2" aria-label="Close navigation">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <SidebarNav pendingApprovals={pendingApprovals} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
