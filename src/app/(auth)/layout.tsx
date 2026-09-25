export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md border border-accent/40 bg-accent/10 font-mono text-xs font-bold text-accent-strong">
            PL
          </span>
          <div>
            <p className="text-sm font-semibold">POD Lab</p>
            <p className="text-xs text-muted">Brand discovery → launch → test → scale</p>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-5">{children}</div>
      </div>
    </main>
  );
}
