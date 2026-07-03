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
    await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inc),
    });
  } catch {}
}

async function clearIncidents() {
  try {
    await fetch('/api/incidents', { method: 'DELETE' });
  } catch {}
}

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    fetchIncidents().then(setIncidents);
  }, []);

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
      postIncident(inc);
      setIncidents((prev) => [...prev, inc]);
    },
    [isReporting],
  );

  const handleClear = () => {
    clearIncidents();
    setIncidents([]);
  };

  return (
    <div className="flex h-screen w-screen">
      <aside className="w-1/5 min-w-[250px] h-full overflow-y-auto border-r border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-xl font-bold">Crime Map</h1>
          <p className="text-sm text-zinc-500">Khulna City</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {incidents.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8">
              No incidents reported yet.
              <br />
              Click &quot;Report Incident&quot; to start.
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
              onClick={handleClear}
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
