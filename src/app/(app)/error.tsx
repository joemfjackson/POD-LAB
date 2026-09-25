"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-lg border border-critical/40 bg-critical/5 p-6">
      <h1 className="text-base font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-2">This page failed to load. The error has been logged{error.digest ? ` (reference ${error.digest})` : ""}.</p>
      <Button variant="primary" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
