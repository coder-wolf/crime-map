'use client';

import React, { useState } from 'react';
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
} from 'react-leaflet';
import {
  type Incident,
  type CrimeCluster,
  CRIME_TYPES,
  REPORT_AGE_OPTIONS,
  getSafetyColor,
  PRIMARY_RADIUS,
  SECONDARY_RADIUS,
} from './data';

export type MapBounds = [[number, number], [number, number]];

const ClickHandler = React.memo(function ClickHandler({
  isReporting,
  onClick,
}: {
  isReporting: boolean;
  onClick: (latlng: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      if (isReporting) {
        onClick([e.latlng.lat, e.latlng.lng]);
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

const MapView = React.memo(function MapView({
  incidents,
  clusters,
  isReporting,
  pendingLocation,
  onReport,
  onSelectCrime,
  onCancelReport,
  onBoundsChange,
}: {
  incidents: Incident[];
  clusters: CrimeCluster[];
  isReporting: boolean;
  pendingLocation: [number, number] | null;
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickHandler isReporting={isReporting} onClick={onReport} />
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

      {clusters.filter((c) => c.polygon.length >= 3).map((cluster) => (
        <Polygon
          key={cluster.id}
          positions={cluster.polygon}
          pathOptions={{
            color: getSafetyColor(cluster.safetyScore),
            fillColor: getSafetyColor(cluster.safetyScore),
            fillOpacity: 0.4,
            weight: 2,
          }}
        >
          <Tooltip>
            <strong>Crime Cluster</strong>
            <br />
            Incidents: {cluster.incidents.length}
            <br />
            Safety: {cluster.safetyScore}/100
          </Tooltip>
        </Polygon>
      ))}

      {incidents.filter((inc) => Number.isFinite(inc.lat) && Number.isFinite(inc.lng)).map((inc) => (
        <React.Fragment key={inc.id}>
          <Circle
            center={[inc.lat, inc.lng]}
            radius={SECONDARY_RADIUS * 111000}
            pathOptions={{
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.04,
              weight: 0.5,
              dashArray: '4 4',
            }}
          />
          <Circle
            center={[inc.lat, inc.lng]}
            radius={PRIMARY_RADIUS * 111000}
            pathOptions={{
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.08,
              weight: 1,
            }}
          />
          <Marker
            position={[inc.lat, inc.lng]}
            icon={L.divIcon({
              className: '',
              html: `<span style="font-size:22px;line-height:1">${CRIME_TYPES.find((c) => c.id === inc.crimeType)?.emoji ?? '❓'}</span>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            })}
          >
          </Marker>
        </React.Fragment>
      ))}

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
