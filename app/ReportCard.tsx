'use client';

import { useState, useMemo } from 'react';
import { type Incident, CRIME_TYPES, REPORT_AGE_OPTIONS, getSafetyLabel, getSafetyColor } from './data';
import type { MapBounds } from './MapView';

function countBy<T>(items: T[], keyFn: (item: T) => string): [string, number][] {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = keyFn(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function isIncidentVisible(inc: Incident, bounds: MapBounds | null): boolean {
  if (!bounds) return true;
  const [[south, west], [north, east]] = bounds;
  return inc.lat >= south && inc.lat <= north && inc.lng >= west && inc.lng <= east;
}

function areaLabel(incidents: Incident[]): string {
  if (incidents.length === 0) return 'No incidents';
  if (incidents.length <= 2) return 'Low Crime';
  if (incidents.length <= 5) return 'Moderate Crime';
  if (incidents.length <= 10) return 'High Crime';
  return 'Very High Crime';
}

function areaScore(incidents: Incident[]): number {
  if (incidents.length === 0) return 95;
  const score = Math.max(10, Math.min(95, 110 - incidents.length * 10));
  return Math.round(score);
}

export default function ReportCard({
  incidents,
  bounds,
}: {
  incidents: Incident[];
  bounds: MapBounds | null;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const visible = useMemo(
    () => incidents.filter((inc) => isIncidentVisible(inc, bounds)),
    [incidents, bounds],
  );

  const byType = useMemo(
    () => countBy(visible, (inc) => inc.crimeType).slice(0, 5),
    [visible],
  );

  const byAge = useMemo(
    () => countBy(visible, (inc) => inc.age).slice(0, 5),
    [visible],
  );

  const score = useMemo(() => areaScore(visible), [visible]);
  const label = useMemo(() => areaLabel(visible), [visible]);

  return (
    <div className="fixed bottom-4 right-4 z-[9998] w-64 max-h-[60vh] flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden transition-all duration-200">
      <button
        onClick={() => setCollapsed((p) => !p)}
        className="flex items-center justify-between px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Area Report
          </span>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: getSafetyColor(score) }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs tabular-nums text-zinc-500">{visible.length}</span>
          <span className="text-xs text-zinc-400">{collapsed ? '▸' : '▾'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
          {visible.length === 0 && (
            <p className="text-zinc-400 text-center py-4">No incidents in this area.</p>
          )}

          {byType.length > 0 && (
            <div>
              <p className="font-medium text-zinc-500 mb-1.5 uppercase tracking-wider text-[10px]">
                By Crime Type
              </p>
              <div className="space-y-1">
                {byType.map(([typeId, count]) => {
                  const ct = CRIME_TYPES.find((c) => c.id === typeId);
                  return (
                    <div key={typeId} className="flex items-center justify-between">
                      <span>
                        {ct?.emoji ?? '❓'} {ct?.label ?? typeId}
                      </span>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {byAge.length > 0 && (
            <div>
              <p className="font-medium text-zinc-500 mb-1.5 uppercase tracking-wider text-[10px]">
                By Recency
              </p>
              <div className="space-y-1">
                {byAge.map(([ageId, count]) => {
                  const opt = REPORT_AGE_OPTIONS.find((a) => a.id === ageId);
                  return (
                    <div key={ageId} className="flex items-center justify-between">
                      <span>{opt?.label ?? ageId}</span>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between"
          >
            <span
              className="font-semibold text-sm"
              style={{ color: getSafetyColor(score) }}
            >
              {label}
            </span>
            <span className="text-zinc-400 tabular-nums">{score}/100</span>
          </div>
        </div>
      )}
    </div>
  );
}
