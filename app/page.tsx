'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  type Incident,
  type CrimeCluster,
  getSafetyColor,
  getSafetyLabel,
  clusterIncidents,
} from './data';
import type { MapBounds } from './MapView';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

async function fetchIncidents(): Promise<Incident[]> {
  try {
    const res = await fetch('/api/incidents');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function postIncident(inc: Incident) {
  try {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inc),
    });
    if (!res.ok) console.error('POST /api/incidents failed', await res.text());
  } catch (e) {
    console.error('POST /api/incidents threw', e);
  }
}

async function clearIncidents() {
  try {
    const res = await fetch('/api/incidents', { method: 'DELETE' });
    if (!res.ok) console.error('DELETE /api/incidents failed', await res.text());
  } catch (e) {
    console.error('DELETE /api/incidents threw', e);
  }
}

function formatCoord(n: number, isLat: boolean): string {
  const dir = isLat ? (n >= 0 ? 'N' : 'S') : n >= 0 ? 'E' : 'W';
  return `${Math.abs(n).toFixed(4)}°${dir}`;
}

function isClusterVisible(
  cluster: CrimeCluster,
  bounds: MapBounds | null,
): boolean {
  if (!bounds) return true;
  const [[south, west], [north, east]] = bounds;
  return cluster.polygon.some(
    ([lat, lng]) => lat >= south && lat <= north && lng >= west && lng <= east,
  );
}

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isReporting, setIsReporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bounds, setBounds] = useState<MapBounds | null>(null);

  useEffect(() => {
    fetchIncidents().then(setIncidents);
  }, []);

  const clusters = useMemo<CrimeCluster[]>(
    () => clusterIncidents(incidents),
    [incidents],
  );

  const visibleClusters = useMemo(
    () => clusters.filter((c) => isClusterVisible(c, bounds)),
    [clusters, bounds],
  );

  const sorted = useMemo(
    () => [...visibleClusters].sort((a, b) => a.safetyScore - b.safetyScore),
    [visibleClusters],
  );

  const centerLabel = useMemo(() => {
    if (!bounds) return 'Loading...';
    const [[s, w], [n, e]] = bounds;
    const lat = (s + n) / 2;
    const lng = (w + e) / 2;
    return `${formatCoord(lat, true)}, ${formatCoord(lng, false)}`;
  }, [bounds]);

  const handleMapClick = useCallback(
    (latlng: [number, number]) => {
      if (!isReporting) return;
      const inc: Incident = {
        id: `inc-${Date.now()}`,
        lat: latlng[0],
        lng: latlng[1],
      };
      postIncident(inc);
      setIncidents((prev) => [...prev, inc]);
    },
    [isReporting],
  );

  const handleClear = () => {
    clearIncidents();
    setIncidents([]);
  };

  const sidebarWidth = 260;

  return (
    <div className="flex h-screen w-screen relative overflow-hidden">
      <aside
        className="h-full overflow-y-auto border-r border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out"
        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <h1 className="text-xl font-bold">Crime Map</h1>
          <p className="text-xs text-zinc-500 truncate">{centerLabel}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 min-w-0">
          {incidents.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8 px-2">
              No incidents reported yet.
              <br />
              Click &quot;Report Incident&quot; to start.
            </p>
          )}
          {incidents.length > 0 && sorted.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8 px-2">
              No clusters visible at this zoom level.
            </p>
          )}
          {sorted.map((cluster) => (
            <div
              key={cluster.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer transition-colors"
            >
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: getSafetyColor(cluster.safetyScore) }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {getSafetyLabel(cluster.safetyScore)} Zone
                </p>
                <p className="text-xs text-zinc-400 truncate">
                  {cluster.incidents.length} incidents &middot;{' '}
                  {cluster.incidents.length > 0
                    ? `~${(
                        cluster.incidents.reduce((s, i) => s + i.lat, 0) /
                        cluster.incidents.length
                      ).toFixed(3)}, ${(
                        cluster.incidents.reduce((s, i) => s + i.lng, 0) /
                        cluster.incidents.length
                      ).toFixed(3)}`
                    : ''}
                </p>
              </div>
              <span className="text-xs font-semibold tabular-nums">
                {cluster.safetyScore}
              </span>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2 shrink-0">
          <div
            className="h-3 rounded-full"
            style={{
              background:
                'linear-gradient(to right, #d0312d, #e06b2b, #e8a830, #7ebc42, #2d8a4e)',
            }}
          />
          <div className="flex justify-between text-xs text-zinc-400 mt-1">
            <span>Dangerous</span>
            <span>Safe</span>
          </div>

          {isReporting ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">
                Click anywhere on the map to report an incident.
              </p>
              <button
                onClick={() => setIsReporting(false)}
                className="w-full px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                Done Reporting
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsReporting(true)}
              className="w-full px-3 py-2 text-sm rounded border border-dashed border-zinc-400 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              + Report Incident
            </button>
          )}

          {incidents.length > 0 && (
            <button
              onClick={handleClear}
              className="w-full px-3 py-1.5 text-xs rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Clear all ({incidents.length}) incidents
            </button>
          )}
        </div>
      </aside>

      <button
        onClick={() => setSidebarOpen((p) => !p)}
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        className="absolute top-1/2 -translate-y-1/2 z-20 w-7 h-14 flex items-center justify-center bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 shadow-lg hover:shadow-xl hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all cursor-pointer group"
        style={{
          left: sidebarOpen ? sidebarWidth - 1 : 0,
          borderRadius: sidebarOpen ? '0 8px 8px 0' : '0 8px 8px 0',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderLeft: sidebarOpen ? 'none' : undefined,
        }}
      >
        <svg
          className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={sidebarOpen ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
          />
        </svg>
      </button>

      <main className="flex-1 h-full min-w-0">
        <MapView
          incidents={incidents}
          clusters={clusters}
          isReporting={isReporting}
          onReport={handleMapClick}
          onBoundsChange={setBounds}
        />
      </main>
    </div>
  );
}
