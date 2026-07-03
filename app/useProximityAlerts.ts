'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { type CrimeCluster, pointInPolygon, metersToDeg, getSafetyLabel } from './data';

const PROXIMITY_METERS = 100;

export interface NearbyCluster {
  cluster: CrimeCluster;
  distance: number;
}

export function useProximityAlerts(clusters: CrimeCluster[]) {
  const [enabled, setEnabled] = useState(false);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearbyClusters, setNearbyClusters] = useState<NearbyCluster[]>([]);
  const [position, setPosition] = useState<GeolocationCoordinates | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const alertedRef = useRef<Set<string>>(new Set());
  const notifiedRef = useRef(false);

  const requestNotifyPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }, []);

  const sendNotification = useCallback((nc: NearbyCluster) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const label = getSafetyLabel(nc.cluster.safetyScore);
    new Notification('⚠️ Crime Alert', {
      body: `You're near a ${label} zone (${nc.cluster.incidents.length} incident${nc.cluster.incidents.length === 1 ? '' : 's'})`,
      icon: '/favicon.ico',
      tag: nc.cluster.id,
      requireInteraction: true,
    });
  }, []);

  const checkProximity = useCallback((pos: GeolocationPosition, clusterList: CrimeCluster[]) => {
    const user: [number, number] = [pos.coords.latitude, pos.coords.longitude];
    const thresholdDeg = metersToDeg(PROXIMITY_METERS);
    const nearby: NearbyCluster[] = [];

    for (const cluster of clusterList) {
      if (cluster.safetyScore > 60) continue;

      const inside = pointInPolygon(user, cluster.polygon);
      if (!inside) {
        let isNear = false;
        for (const p of cluster.polygon) {
          const d = Math.sqrt((p[0] - user[0]) ** 2 + (p[1] - user[1]) ** 2);
          if (d <= thresholdDeg) { isNear = true; break; }
        }
        if (!isNear) continue;
      }

      const dist = inside ? 0 : Math.min(...cluster.polygon.map(p =>
        Math.sqrt((p[0] - user[0]) ** 2 + (p[1] - user[1]) ** 2)
      ));
      nearby.push({ cluster, distance: Math.round(dist * 111320) });
    }

    setNearbyClusters(nearby);
    setPosition(pos.coords);

    for (const nc of nearby) {
      if (alertedRef.current.has(nc.cluster.id)) continue;
      alertedRef.current.add(nc.cluster.id);
      sendNotification(nc);
    }
  }, [sendNotification]);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setWatching(false);
      setError(null);
      setNearbyClusters([]);
      return;
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      setEnabled(false);
      return;
    }

    let cancelled = false;

    const start = async () => {
      const notifyOk = await requestNotifyPermission();
      if (!notifyOk) {
        notifiedRef.current = true;
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          setError(null);
          setWatching(true);
          checkProximity(pos, clusters);
        },
        (err) => {
          if (cancelled) return;
          setWatching(false);
          switch (err.code) {
            case err.PERMISSION_DENIED:
              setError('Location access denied');
              setEnabled(false);
              break;
            case err.POSITION_UNAVAILABLE:
              setError('GPS signal unavailable');
              break;
            case err.TIMEOUT:
              setError('GPS timed out');
              break;
            default:
              setError('Location error');
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
      );
    };

    start();

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, clusters, checkProximity, requestNotifyPermission]);

  const toggle = useCallback(() => {
    if (!enabled) {
      alertedRef.current = new Set();
    }
    setEnabled((p) => !p);
  }, [enabled]);

  return { enabled, toggle, watching, error, nearbyClusters, position };
}