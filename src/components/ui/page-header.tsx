import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  breadcrumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="mb-1 text-xs text-muted">
            <ol className="flex flex-wrap items-center gap-1">
              {breadcrumbs.map((b, i) => (
                <li key={`${b.label}-${i}`} className="flex items-center gap-1">
                  {b.href ? (
                    <Link href={b.href} className="hover:text-ink">
                      {b.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{b.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 ? <span aria-hidden>/</span> : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        {eyebrow ? <div className="mb-1">{eyebrow}</div> : null}
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
