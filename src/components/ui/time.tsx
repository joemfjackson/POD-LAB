import { formatDateTime, formatRelative } from "@/domain/format";

export function Time({ value, relative = true }: { value: string | null | undefined; relative?: boolean }) {
  if (!value) return <span className="text-muted">—</span>;
  return (
    <time dateTime={value} title={formatDateTime(value)} className="whitespace-nowrap text-ink-2">
      {relative ? formatRelative(value) : formatDateTime(value)}
    </time>
  );
}
