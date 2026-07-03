'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  type Incident,
  type CrimeCluster,
  getSafetyColor,
  getSafetyLabel,
  getRecencyColor,
  clusterIncidents,
  fetchLocationName,
} from './data';
import type { MapBounds } from './MapView';
import ReportCard from './ReportCard';
import { useProximityAlerts } from './useProximityAlerts';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

async function fetchIncidents(): Promise<Incident[]> {
  try {
    const res = await fetch('/api/incidents');
    if (!res.ok) return [];
    const data = await res.json();
    return data.filter(
      (d: Incident) => Number.isFinite(d.lat) && Number.isFinite(d.lng)
    );
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
  const [pendingLocation, setPendingLocation] = useState<[number, number] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [clusterNames, setClusterNames] = useState<Record<string, string>>({});
  const [polygonColorMode, setPolygonColorMode] = useState<'gray' | 'color'>('color');

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

  useEffect(() => {
    if (clusters.length === 0) return;
    let cancelled = false;

    async function fetchNames() {
      const names: Record<string, string> = {};
      for (const cluster of clusters) {
        if (cancelled) break;
        const lat = cluster.incidents.reduce((s, i) => s + i.lat, 0) / cluster.incidents.length;
        const lng = cluster.incidents.reduce((s, i) => s + i.lng, 0) / cluster.incidents.length;
        names[cluster.id] = await fetchLocationName(lat, lng);
      }
      if (!cancelled) {
        setClusterNames((prev) => ({ ...prev, ...names }));
      }
    }

    fetchNames();
    return () => { cancelled = true; };
  }, [clusters]);

  const handleClusterSelect = useCallback((id: string | null) => {
    setSelectedClusterId(id);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedClusterId(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const {
    enabled: alertsEnabled,
    toggle: toggleAlerts,
    watching,
    error: alertError,
    nearbyClusters,
  } = useProximityAlerts(clusters);

  const centerLabel = useMemo(() => {
    if (!bounds) return 'Loading...';
    const [[s, w], [n, e]] = bounds;
    const lat = (s + n) / 2;
    const lng = (w + e) / 2;
    return `${formatCoord(lat, true)}, ${formatCoord(lng, false)}`;
  }, [bounds]);

  const handleMapClick = useCallback(
    (latlng: [number, number]) => {
      if (!isReporting || pendingLocation) return;
      setPendingLocation(latlng);
    },
    [isReporting, pendingLocation],
  );

  const handleCrimeSelect = useCallback(
    (crimeType: string, age: string, latlng: [number, number]) => {
      const inc: Incident = {
        id: `inc-${Date.now()}`,
        lat: latlng[0],
        lng: latlng[1],
        crimeType,
        age,
      };
      postIncident(inc);
      setIncidents((prev) => [...prev, inc]);
      setPendingLocation(null);
    },
    [],
  );

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const dragRef = useRef({ dragging: false, startX: 0, startWidth: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { dragging: true, startX: e.clientX, startWidth: sidebarWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const newWidth = Math.max(180, Math.min(600, dragRef.current.startWidth + (e.clientX - dragRef.current.startX)));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (!dragRef.current.dragging) return;
      dragRef.current.dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleCancelReport = useCallback(() => {
    setPendingLocation(null);
  }, []);

  return (
    <div className="flex h-screen w-screen relative overflow-hidden">
      <aside
        className="h-full overflow-y-auto border-r border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800 flex flex-col shrink-0 relative"
        style={{ width: sidebarOpen ? sidebarWidth : 0, transition: sidebarOpen ? 'none' : 'width 0.3s ease-in-out' }}
      >
        <div
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 z-10"
          onMouseDown={handleDragStart}
        />
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((p) => !p)}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Toggle sidebar"
          >
            <svg className="w-5 h-5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">Crime Map</h1>
            <p className="text-xs text-zinc-500 truncate">{centerLabel}</p>
          </div>
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
          {sorted.map((cluster) => {
            const lat = cluster.incidents.reduce((s, i) => s + i.lat, 0) / cluster.incidents.length;
            const lng = cluster.incidents.reduce((s, i) => s + i.lng, 0) / cluster.incidents.length;
            const locationName = clusterNames[cluster.id] || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            const isSelected = cluster.id === selectedClusterId;
            return (
              <div
                key={cluster.id}
                onClick={() => setSelectedClusterId(isSelected ? null : cluster.id)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: getSafetyColor(cluster.safetyScore) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {locationName}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {getSafetyLabel(cluster.safetyScore)}
                  </p>
                </div>
                <span className="text-xs font-semibold tabular-nums">
                  {cluster.incidents.length}
                </span>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2 shrink-0">
          <div
            className="h-3 rounded-full"
            style={{
              background:
                'linear-gradient(to right, #e62e2e, #e65731, #d97731, #c99833, #b8b333)',
            }}
          />
          <div className="flex justify-between text-xs text-zinc-400 mt-1">
            <span>High Crime</span>
            <span>Low Crime</span>
          </div>
          <button
            onClick={() => setPolygonColorMode(p => p === 'gray' ? 'color' : 'gray')}
            className="w-full text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-zinc-500"
          >
            {polygonColorMode === 'gray' ? 'Show Color Map' : 'Show Gray Map'}
          </button>

          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
                Crime Alerts
              </span>
              {alertsEnabled && (
                <span className="flex items-center gap-1">
                  {watching ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                      <span className="text-[10px] text-green-600">Watching</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-amber-600">Connecting...</span>
                  )}
                </span>
              )}
            </div>
            <button
              onClick={toggleAlerts}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer shrink-0 ${
                alertsEnabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  alertsEnabled ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </div>

          {alertError && (
            <p className="text-[10px] text-red-500 leading-snug">{alertError}</p>
          )}

          {nearbyClusters.length > 0 && (
            <div className="space-y-1">
              {nearbyClusters.map((nc) => {
                const dangerColor = getRecencyColor(nc.cluster.incidents[0]?.age ?? 'older');
                return (
                  <div
                    key={nc.cluster.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dangerColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-red-700 dark:text-red-400 truncate">
                        {getSafetyLabel(nc.cluster.safetyScore)} Zone
                      </p>
                      <p className="text-[9px] text-red-500/70">
                        {nc.cluster.incidents.length} incidents · {nc.distance}m away
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isReporting ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">
                Click anywhere on the map to report an incident.
              </p>
              <button
                onClick={() => { setIsReporting(false); setPendingLocation(null); }}
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
        </div>
      </aside>

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-[9999] w-9 h-9 flex items-center justify-center rounded-md bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 shadow-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all cursor-pointer"
          title="Show sidebar"
        >
          <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      <main className="flex-1 h-full min-w-0">
        <MapView
          incidents={incidents}
          clusters={clusters}
          isReporting={isReporting}
          pendingLocation={pendingLocation}
          polygonColorMode={polygonColorMode}
          selectedClusterId={selectedClusterId}
          onClusterSelect={handleClusterSelect}
          onReport={handleMapClick}
          onSelectCrime={handleCrimeSelect}
          onCancelReport={handleCancelReport}
          onBoundsChange={setBounds}
        />
      </main>

      <ReportCard incidents={incidents} bounds={bounds} />
    </div>
  );
}
