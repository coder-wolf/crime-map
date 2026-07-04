'use client';

import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Circle,
  Marker,
  Popup,
  Tooltip,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import {
  type Incident,
  type CrimeCluster,
  CRIME_TYPES,
  REPORT_AGE_OPTIONS,
  getSafetyColor,
  getRecencyColor,
  getIncidentDetails,
  PRIMARY_RADIUS,
  SECONDARY_RADIUS,
} from './data';

export type MapBounds = [[number, number], [number, number]];

const ClickHandler = React.memo(function ClickHandler({
  isReporting,
  onClick,
  onDeselect,
  hasSelection,
  skippedRef,
}: {
  isReporting: boolean;
  onClick: (latlng: [number, number]) => void;
  onDeselect: () => void;
  hasSelection: boolean;
  skippedRef: React.MutableRefObject<boolean>;
}) {
  useMapEvents({
    click(e) {
      if (skippedRef.current) {
        skippedRef.current = false;
        return;
      }
      if (isReporting) {
        onClick([e.latlng.lat, e.latlng.lng]);
      } else if (hasSelection) {
        onDeselect();
      }
    },
  });
  return null;
});

function BoundsReporter({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: MapBounds) => void;
}) {
  const map = useMapEvents({
    moveend() {
      report();
    },
  });

  function report() {
    const b = map.getBounds();
    onBoundsChange([[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]]);
  }

  React.useEffect(() => {
    report();
  }, []);

  return null;
}

function MapResizer() {
  const map = useMap();

  useEffect(() => {
    if (!map.getContainer()) return;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

function UserLocationHandler({
  userPosition,
}: {
  userPosition: [number, number] | null;
}) {
  const map = useMap();
  const hasFlown = useRef(false);

  useEffect(() => {
    if (!userPosition || hasFlown.current) return;
    hasFlown.current = true;
    map.flyTo(userPosition, 15, { duration: 1.5 });
  }, [userPosition, map]);

  return null;
}

const MapView = React.memo(function MapView({
  incidents,
  clusters,
  isReporting,
  pendingLocation,
  polygonColorMode,
  selectedClusterId,
  onClusterSelect,
  onReport,
  onSelectCrime,
  onCancelReport,
  onBoundsChange,
}: {
  incidents: Incident[];
  clusters: CrimeCluster[];
  isReporting: boolean;
  pendingLocation: [number, number] | null;
  polygonColorMode: 'gray' | 'color';
  selectedClusterId: string | null;
  onClusterSelect: (id: string | null) => void;
  onReport: (latlng: [number, number]) => void;
  onSelectCrime: (crimeType: string, age: string, latlng: [number, number]) => void;
  onCancelReport: () => void;
  onBoundsChange: (bounds: MapBounds) => void;
}) {
  const [step, setStep] = useState<'type' | 'age'>('type');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  React.useEffect(() => {
    setStep('type');
    setSelectedType(null);
  }, [pendingLocation]);

  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserPosition([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.warn('GPS:', err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const polygonClickedRef = useRef(false);

  const incidentClusterMap = useRef<Map<string, string>>(new Map());
  incidentClusterMap.current.clear();
  for (const c of clusters) {
    for (const inc of c.incidents) {
      incidentClusterMap.current.set(inc.id, c.id);
    }
  }

  return (
    <MapContainer
      key="map"
      center={[22.82, 89.555]}
      zoom={13}
      className="h-full w-full"
      zoomControl={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <MapResizer />
      <ClickHandler isReporting={isReporting} onClick={onReport} onDeselect={() => onClusterSelect(null)} hasSelection={selectedClusterId !== null} skippedRef={polygonClickedRef} />
      <BoundsReporter onBoundsChange={onBoundsChange} />

      {pendingLocation && (
        <Popup position={pendingLocation}>
          <div className="min-w-[220px]">
            <div className="flex items-center justify-between mb-2">
              {step === 'age' ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setStep('type'); }}
                  className="text-xs text-zinc-500 hover:text-zinc-800 cursor-pointer"
                >
                  ← Back
                </button>
              ) : (
                <h3 className="text-sm font-semibold text-zinc-800">Report Incident</h3>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onCancelReport(); }}
                className="text-xs text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {step === 'type' && (
              <>
                <p className="text-[11px] text-zinc-500 mb-2">
                  What type of crime?
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {CRIME_TYPES.map((ct) => (
                    <button
                      key={ct.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedType(ct.id);
                        setStep('age');
                      }}
                      className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 transition-colors cursor-pointer"
                    >
                      <span className="text-base leading-none">{ct.emoji}</span>
                      <span className="text-[10px] text-zinc-600 leading-tight text-center">
                        {ct.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 'age' && selectedType && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{CRIME_TYPES.find((c) => c.id === selectedType)?.emoji}</span>
                  <span className="text-sm font-medium text-zinc-700">
                    {CRIME_TYPES.find((c) => c.id === selectedType)?.label}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mb-2">
                  How recent was this crime?
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {REPORT_AGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCrime(selectedType, opt.id, pendingLocation);
                      }}
                      className="px-3 py-2 rounded border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-xs text-zinc-700 transition-colors cursor-pointer"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </Popup>
      )}

      {clusters.filter((c) => c.polygon.length >= 3).map((cluster) => {
        const isSelected = cluster.id === selectedClusterId;
        const baseColor = polygonColorMode === 'color' ? getSafetyColor(cluster.safetyScore) : '#6b7280';
        const color = isSelected ? '#3b82f6' : baseColor;
        return (
          <Polygon
            key={cluster.id}
            positions={cluster.polygon}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: isSelected ? 0.4 : 0.25,
              weight: isSelected ? 3 : 1.5,
            }}
            eventHandlers={{
              click: () => {
                polygonClickedRef.current = true;
                onClusterSelect(cluster.id);
              },
            }}
          />
        );
      })}

      {incidents.filter((inc) => Number.isFinite(inc.lat) && Number.isFinite(inc.lng)).map((inc) => {
        const ct = CRIME_TYPES.find((c) => c.id === inc.crimeType);
        const ageLabel = REPORT_AGE_OPTIONS.find((a) => a.id === inc.age)?.label ?? inc.age;
        const details = getIncidentDetails(inc);
        const recencyColor = getRecencyColor(inc.age);
        const formattedDate = details.date.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        });
        const formattedTime = details.date.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit',
        });

        return (
          <React.Fragment key={inc.id}>
            <Circle
              center={[inc.lat, inc.lng]}
              radius={SECONDARY_RADIUS * 111000}
              pathOptions={{
                color: recencyColor,
                fillColor: recencyColor,
                fillOpacity: 0.04,
                weight: 0.5,
                dashArray: '4 4',
              }}
            />
            <Circle
              center={[inc.lat, inc.lng]}
              radius={PRIMARY_RADIUS * 111000}
              pathOptions={{
                color: recencyColor,
                fillColor: recencyColor,
                fillOpacity: 0.08,
                weight: 1,
              }}
            />
            <Marker
              position={[inc.lat, inc.lng]}
              icon={L.divIcon({
                className: '',
                html: `<span style="font-size:22px;line-height:1">${ct?.emoji ?? '❓'}</span>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              })}
              eventHandlers={{
                click: () => {
                  const clusterId = incidentClusterMap.current.get(inc.id);
                  if (clusterId) {
                    polygonClickedRef.current = true;
                    onClusterSelect(clusterId);
                  }
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -14]} className="crime-tooltip">
                <div className="min-w-[200px] text-left">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{ct?.emoji ?? '❓'}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-zinc-800 leading-tight">
                        {ct?.label ?? inc.crimeType}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-mono">{details.caseNumber}</p>
                    </div>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: recencyColor + '22',
                        color: recencyColor,
                      }}
                    >
                      {ageLabel}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 mb-1.5 leading-snug">{details.description}</p>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span>{details.reportedBy}</span>
                    <span>{formattedDate} {formattedTime}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1">
                    Status: <span className="font-medium text-zinc-500">{details.status}</span>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          </React.Fragment>
        );
      })}

      {userPosition && (
        <Marker
          position={userPosition}
          icon={L.divIcon({
            className: '',
            html: `<div style="width:24px;height:24px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 2px #3b82f6,0 2px 6px rgba(0,0,0,0.3)"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            <div className="text-xs font-medium">Your Location</div>
          </Tooltip>
        </Marker>
      )}

      {isReporting && !pendingLocation && (
        <div
          className="leaflet-top leaflet-right"
          style={{ pointerEvents: 'none' }}
        >
          <div className="leaflet-control text-xs px-2 py-1 bg-black/70 text-white rounded m-2">
            Click the map to report an incident
          </div>
        </div>
      )}
    </MapContainer>
  );
});

export default MapView;
