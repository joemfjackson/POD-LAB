"use client";

import { useId, useState } from "react";
import { formatValue, niceTicks, type ValueFormat } from "./scale";

export interface LineSeries {
  name: string;
  values: number[];
}

const SERIES = ["var(--color-series-1)", "var(--color-series-2)", "var(--color-series-3)", "var(--color-series-4)"];

/**
 * Multi-series line chart (≤ 4 series, fixed slot order). 2px lines, crosshair
 * that snaps to the nearest X with a tooltip listing every series, legend,
 * end-value labels and a table view.
 */
export function LineChart({ labels, series, valueFormat = "number", height = 200, ariaLabel }: { labels: string[]; series: LineSeries[]; valueFormat?: ValueFormat; height?: number; ariaLabel: string }) {
  const id = useId();
  const format = (v: number) => formatValue(v, valueFormat);
  const [active, setActive] = useState<number | null>(null);
  const s = series.slice(0, 4);
  const width = 640;
  const pad = { top: 12, right: 56, bottom: 22, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(0, ...s.flatMap((x) => x.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const n = labels.length;
  const x = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (Math.max(0, v) / top) * innerH;
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  return (
    <figure className="relative">
      {s.length > 1 ? (
        <ul className="mb-2 flex flex-wrap gap-3 text-xs text-ink-2" aria-label="Legend">
          {s.map((ser, i) => (
            <li key={ser.name} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: SERIES[i] }} />
              {ser.name}
            </li>
          ))}
        </ul>
      ) : null}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-labelledby={`${id}-t`}
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * width;
          const i = n <= 1 ? 0 : Math.round(((px - pad.left) / innerW) * (n - 1));
          setActive(Math.max(0, Math.min(n - 1, i)));
        }}
        onPointerLeave={() => setActive(null)}
      >
        <title id={`${id}-t`}>{ariaLabel}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={pad.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--color-muted)">
              {format(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % labelEvery === 0 ? (
            <text key={`${l}-${i}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--color-muted)">
              {l}
            </text>
          ) : null,
        )}
        {active !== null ? <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerH} stroke="var(--color-line-strong)" strokeWidth={1} /> : null}
        {s.map((ser, si) => {
          const d = ser.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
          const last = ser.values.length - 1;
          return (
            <g key={ser.name}>
              <path d={d} fill="none" stroke={SERIES[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {last >= 0 ? (
                <>
                  <circle cx={x(last)} cy={y(ser.values[last]!)} r={4} fill={SERIES[si]} stroke="var(--color-surface)" strokeWidth={2} />
                  <text x={x(last) + 8} y={y(ser.values[last]!)} dominantBaseline="middle" fontSize={10} fill="var(--color-ink-2)">
                    {format(ser.values[last]!)}
                  </text>
                </>
              ) : null}
              {active !== null && ser.values[active] !== undefined ? (
                <circle cx={x(active)} cy={y(ser.values[active]!)} r={4} fill={SERIES[si]} stroke="var(--color-surface)" strokeWidth={2} />
              ) : null}
            </g>
          );
        })}
      </svg>
      {active !== null ? (
        <div role="status" className="pointer-events-none absolute top-6 rounded-md border border-line-strong bg-surface-3 px-2 py-1 text-xs shadow-lg" style={{ left: `${Math.min(75, (x(active) / width) * 100)}%` }}>
          <p className="mb-0.5 text-muted">{labels[active]}</p>
          {s.map((ser, si) => (
            <p key={ser.name} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: SERIES[si] }} />
              <span className="font-semibold text-ink tabular">{format(ser.values[active] ?? 0)}</span>
              <span className="text-muted">{ser.name}</span>
            </p>
          ))}
        </div>
      ) : null}
      <details className="mt-1 text-xs text-muted">
        <summary className="cursor-pointer">Table view</summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-left">
            <thead>
              <tr>
                <th className="py-1 font-medium">Date</th>
                {s.map((ser) => (
                  <th key={ser.name} className="py-1 text-right font-medium">
                    {ser.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={`${l}-${i}`} className="border-t border-line">
                  <td className="py-1">{l}</td>
                  {s.map((ser) => (
                    <td key={ser.name} className="py-1 text-right text-ink tabular">
                      {format(ser.values[i] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
