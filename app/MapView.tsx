'use client';

import React from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Circle,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';
import {
  type Incident,
  type CrimeCluster,
  getSafetyColor,
  PRIMARY_RADIUS,
  SECONDARY_RADIUS,
} from './data';

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

const MapView = React.memo(function MapView({
  incidents,
  clusters,
  isReporting,
  onReport,
}: {
  incidents: Incident[];
  clusters: CrimeCluster[];
  isReporting: boolean;
  onReport: (latlng: [number, number]) => void;
}) {
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

      {clusters.map((cluster) => (
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

      {incidents.map((inc) => (
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
          <Circle
            center={[inc.lat, inc.lng]}
            radius={8}
            pathOptions={{
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Tooltip>
              {inc.label ?? 'Incident'}
              <br />
              {inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}
            </Tooltip>
          </Circle>
        </React.Fragment>
      ))}

      {isReporting && (
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
