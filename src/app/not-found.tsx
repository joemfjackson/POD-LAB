import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="text-center">
        <p className="font-mono text-xs text-accent">404</p>
        <h1 className="mt-1 text-lg font-semibold">Not found</h1>
        <p className="mt-1 text-sm text-muted">This record does not exist or you do not have access to it.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-accent hover:underline">
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
