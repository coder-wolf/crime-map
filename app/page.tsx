'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  type Incident,
  type CrimeCluster,
  getSafetyColor,
  getSafetyLabel,
  clusterIncidents,
} from './data';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

function loadIncidents(): Incident[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('crime-map-incidents');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveIncidents(incidents: Incident[]) {
  try {
    localStorage.setItem('crime-map-incidents', JSON.stringify(incidents));
  } catch {}
}

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>(loadIncidents);
  const [isReporting, setIsReporting] = useState(false);

  const clusters = useMemo<CrimeCluster[]>(
    () => clusterIncidents(incidents),
    [incidents],
  );

  const sorted = useMemo(
    () => [...clusters].sort((a, b) => a.safetyScore - b.safetyScore),
    [clusters],
  );

  const handleMapClick = useCallback(
    (latlng: [number, number]) => {
      if (!isReporting) return;
      const inc: Incident = {
        id: `inc-${Date.now()}`,
        lat: latlng[0],
        lng: latlng[1],
      };
      const updated = [...incidents, inc];
      setIncidents(updated);
      saveIncidents(updated);
    },
    [isReporting, incidents],
  );

  const clearIncidents = () => {
    setIncidents([]);
    saveIncidents([]);
  };

  return (
    <div className="flex h-screen w-screen">
      <aside className="w-1/5 min-w-[250px] h-full overflow-y-auto border-r border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-xl font-bold">Crime Map</h1>
          <p className="text-sm text-zinc-500">Khulna City</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sorted.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8">
              {incidents.length === 0
                ? 'No incidents reported yet.\nClick "Report Incident" to start.'
                : 'Not enough data to form clusters.\nNeed at least 2 nearby reports.'}
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
                <p className="text-xs text-zinc-400">
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
              onClick={clearIncidents}
              className="w-full px-3 py-1.5 text-xs rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Clear all ({incidents.length}) incidents
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 h-full">
        <MapView
          incidents={incidents}
          clusters={clusters}
          isReporting={isReporting}
          onReport={handleMapClick}
        />
      </main>
    </div>
  );
}
