/**
 * The dashboard's marks: stat tiles with a sparkline, ranked lists, a stacked
 * daily bar, a two-line chart and a horizontal bar. Thin marks, recessive
 * grid, one axis, a legend for two or more series, a tooltip on every mark.
 * Colors are the validated reference palette, by slot (index.css).
 */

import type { ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { change, type Ranked, type Tile } from "../lib/analytics";

export const SLOTS = 8;
export const slotColor = (i: number) => `var(--series-${i + 1})`;
export const OTHER = "var(--series-other)";

export const sats = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

const axis = { stroke: "var(--chart-axis)", tick: { fill: "var(--chart-muted)", fontSize: 11 }, tickLine: false };

function Tip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="viz-tooltip">
      <div className="mb-1 font-medium">{label ? short(label) : ""}</div>
      {payload.filter((p) => p.value).map((p) => (
        <div key={p.name} className="num">
          <span className="swatch" style={{ background: p.color }} />
          {p.name}: {sats(p.value)} {unit}
        </div>
      ))}
    </div>
  );
}

export function StatTile({ label, tile, format = sats, upIsGood = true }: {
  label: string; tile: Tile; format?: (n: number) => string; upIsGood?: boolean;
}) {
  const delta = change(tile.value, tile.prior);
  const good = delta !== null && (delta >= 0) === upIsGood;
  return (
    <div className="card tile">
      <span className="tile-label">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="tile-value num">{format(tile.value)}</span>
        <div style={{ width: 72, height: 28 }} aria-hidden>
          <ResponsiveContainer>
            <LineChart data={tile.daily.map((v, i) => ({ i, v }))}>
              <Line dataKey="v" stroke="var(--series-1)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <span className={`tile-delta ${delta === null ? "muted" : good ? "delta-up" : "delta-down"}`}>
        {delta === null ? "new this period" : `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta * 100).toFixed(1)}% vs prior period`}
      </span>
    </div>
  );
}

export function FigureTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value num">{value}</span>
      <span className="tile-delta muted">{note}</span>
    </div>
  );
}

export function Panel({ title, action, children, className = "", tour }: {
  title: string; action?: ReactNode; children: ReactNode; className?: string;
  /** The tour's name for this panel. */
  tour?: string;
}) {
  return (
    <section className={`card panel ${className}`} data-tour={tour}>
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function RankedList({ rows, name, unit, empty }: { rows: Ranked[]; name: (key: string) => ReactNode; unit: string; empty: string }) {
  if (!rows.length) return <p className="muted text-sm">{empty}</p>;
  return (
    <div>
      {rows.slice(0, 5).map((r, i) => (
        <div key={r.key} className="rank">
          <span className="muted num">{i + 1}</span>
          <span className="min-w-0 truncate">{name(r.key)}</span>
          <span className="num">{sats(r.value)} <span className="muted text-xs">{unit}</span></span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}><span className="swatch" style={{ background: it.color }} />{it.label}</span>
      ))}
    </div>
  );
}

/** Daily bars stacked by series; a 2px surface gap between segments. */
export function StackedDaily({ data, series, unit, height = 220 }: {
  data: Record<string, number | string>[]; series: { key: string; label: string; color: string }[]; unit: string; height?: number;
}) {
  return (
    <>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="date" tickFormatter={short} {...axis} minTickGap={24} />
            <YAxis {...axis} axisLine={false} width={56} tickFormatter={sats} />
            <Tooltip content={<Tip unit={unit} />} cursor={{ fill: "var(--tb-surface-2)" }} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color}
                stroke="var(--tb-surface)" strokeWidth={2} isAnimationActive={false}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
    </>
  );
}

/** Two measures in one unit over the days: 2px lines, one axis. */
export function DailyLines({ data, series, unit, height = 200 }: {
  data: Record<string, number | string>[]; series: { key: string; label: string; color: string }[]; unit: string; height?: number;
}) {
  return (
    <>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="date" tickFormatter={short} {...axis} minTickGap={24} />
            <YAxis {...axis} axisLine={false} width={56} tickFormatter={sats} />
            <Tooltip content={<Tip unit={unit} />} cursor={{ stroke: "var(--chart-axis)" }} />
            {series.map((s) => (
              <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2}
                dot={false} activeDot={{ r: 4, stroke: "var(--tb-surface)", strokeWidth: 2 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
    </>
  );
}

/** Ranked horizontal bars in one hue: magnitude, not identity. */
export function HBars({ rows, name, unit, empty }: { rows: Ranked[]; name: (key: string) => string; unit: string; empty: string }) {
  if (!rows.length) return <p className="muted text-sm">{empty}</p>;
  const top = rows.slice(0, 8).map((r) => ({ ...r, label: name(r.key) }));
  return (
    <div style={{ width: "100%", height: Math.max(80, top.length * 28 + 16) }}>
      <ResponsiveContainer>
        <BarChart data={top} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={168} {...axis} axisLine={false}
            tickFormatter={(v: string) => (v.length > 26 ? `${v.slice(0, 25)}…` : v)} />
          <Tooltip cursor={{ fill: "var(--tb-surface-2)" }}
            content={({ active, payload }) => active && payload?.length ? (
              <div className="viz-tooltip num">{payload[0].payload.label}: {sats(payload[0].value as number)} {unit}</div>
            ) : null} />
          <Bar dataKey="value" fill="var(--series-1)" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Each Project: funded this period against its budget, as a filled track. */
/** One budget's bar: funded against budget, red once over. */
export function BudgetMeter({ funded, budget }: { funded: number; budget: number }) {
  const share = budget > 0 ? Math.min(1, funded / budget) : 0;
  const over = budget > 0 && funded > budget;
  return (
    <div className="h-2 rounded-full" style={{ background: "var(--tb-surface-2)" }}>
      <div className="h-2 rounded-full" style={{ width: `${share * 100}%`, background: over ? "var(--delta-bad)" : "var(--series-1)" }} />
    </div>
  );
}

export function BudgetBars({ rows }: { rows: { key: string; funded: number; budget: number }[] }) {
  if (!rows.length) return <p className="muted text-sm">No Projects yet.</p>;
  return (
    <div className="grid gap-3">
      {rows.map((r) => {
        const over = r.budget > 0 && r.funded > r.budget;
        return (
          <div key={r.key} title={`${r.key}: ${sats(r.funded)} of ${sats(r.budget)} sats`}>
            <div className="flex justify-between text-sm">
              <span className="truncate">{r.key}</span>
              <span className="num">{sats(r.funded)} <span className="muted">/ {r.budget ? sats(r.budget) : "no budget"}</span></span>
            </div>
            <div className="mt-1"><BudgetMeter funded={r.funded} budget={r.budget} /></div>
            {over && <p className="error mt-1 text-xs">Over budget by {sats(r.funded - r.budget)} sats</p>}
          </div>
        );
      })}
    </div>
  );
}
