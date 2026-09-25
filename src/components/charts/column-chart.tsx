"use client";

import { useId, useState } from "react";
import { formatValue, niceTicks, type ValueFormat } from "./scale";

export interface ColumnDatum {
  label: string;
  value: number;
}

/**
 * Single-series column chart. Columns ≤ 24px, 4px rounded tops, hairline grid,
 * per-column hover/focus tooltip and a table view. The title names the series.
 */
export function ColumnChart({ data, valueFormat = "number", height = 180, ariaLabel }: { data: ColumnDatum[]; valueFormat?: ValueFormat; height?: number; ariaLabel: string }) {
  const id = useId();
  const format = (v: number) => formatValue(v, valueFormat);
  const [active, setActive] = useState<number | null>(null);
  const width = 640;
  const pad = { top: 12, right: 8, bottom: 22, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const band = data.length ? innerW / data.length : innerW;
  const barW = Math.min(24, Math.max(2, band - 2));
  const y = (v: number) => pad.top + innerH - (Math.max(0, v) / top) * innerH;
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const hovered = active !== null ? data[active] : null;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{ariaLabel}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={pad.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--color-muted)">
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * band + (band - barW) / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, h, barW / 2);
          const path =
            h <= 0
              ? ""
              : `M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + barW - r} Q${x + barW},${y(d.value)} ${x + barW},${y(d.value) + r} V${y(0)} Z`;
          return (
            <g key={`${d.label}-${i}`}>
              {path ? <path d={path} fill="var(--color-series-1)" opacity={active === null || active === i ? 1 : 0.55} /> : null}
              <rect
                x={pad.left + i * band}
                y={pad.top}
                width={band}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${format(d.value)}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
              {i % labelEvery === 0 ? (
                <text x={pad.left + i * band + band / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--color-muted)">
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hovered ? (
        <div
          role="status"
          className="pointer-events-none absolute top-1 rounded-md border border-line-strong bg-surface-3 px-2 py-1 text-xs shadow-lg"
          style={{ left: `${Math.min(80, ((pad.left + (active! + 0.5) * band) / width) * 100)}%` }}
        >
          <p className="font-semibold text-ink tabular">{format(hovered.value)}</p>
          <p className="text-muted">{hovered.label}</p>
        </div>
      ) : null}
      <details className="mt-1 text-xs text-muted">
        <summary className="cursor-pointer">Table view</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {data.map((d, i) => (
              <tr key={`${d.label}-${i}`} className="border-t border-line">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right text-ink tabular">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
