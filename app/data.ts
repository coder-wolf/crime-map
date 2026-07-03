export const PRIMARY_RADIUS = 0.0005;
export const SECONDARY_RADIUS = 0.001;

export const CRIME_TYPES = [
  { id: 'theft', label: 'Theft', emoji: '👜' },
  { id: 'robbery', label: 'Robbery', emoji: '🔫' },
  { id: 'assault', label: 'Assault', emoji: '👊' },
  { id: 'burglary', label: 'Burglary', emoji: '🚪' },
  { id: 'vandalism', label: 'Vandalism', emoji: '💢' },
  { id: 'murder', label: 'Murder', emoji: '⚰️' },
  { id: 'drugs', label: 'Drug-related', emoji: '💊' },
  { id: 'fraud', label: 'Fraud', emoji: '📄' },
  { id: 'other', label: 'Other', emoji: '❓' },
] as const;

export const REPORT_AGE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: '1week', label: '1 Week' },
  { id: '1month', label: '1 Month' },
  { id: '6months', label: '6 Months' },
  { id: '1year', label: '1 Year' },
  { id: 'older', label: 'Older' },
] as const;

export interface Incident {
  id: string;
  lat: number;
  lng: number;
  crimeType: string;
  age: string;
  label?: string;
}

export interface CrimeCluster {
  id: string;
  incidents: Incident[];
  polygon: [number, number][];
  safetyScore: number;
}

export function getSafetyColor(score: number): string {
  const hue = (score / 100) * 120;
  return `hsl(${hue}, 70%, 42%)`;
}

export function getSafetyLabel(score: number): string {
  if (score >= 80) return 'Very Safe';
  if (score >= 60) return 'Safe';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Dangerous';
  return 'Very Dangerous';
}

function cross(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return [];

  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function bufferPoint(lat: number, lng: number, radiusDeg: number): [number, number][] {
  const points: [number, number][] = [];
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    points.push([lat + Math.cos(angle) * radiusDeg, lng + Math.sin(angle) * radiusDeg]);
  }
  return points;
}

function dist(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function clusterIncidents(
  incidents: Incident[],
  maxDist: number = 0.008
): CrimeCluster[] {
  if (incidents.length === 0) return [];

  const points = incidents.map((i) => [i.lat, i.lng] as [number, number]);
  const assigned = new Set<number>();
  const rawClusters: number[][] = [];

  for (let i = 0; i < points.length; i++) {
    if (assigned.has(i)) continue;

    const cluster: number[] = [i];
    assigned.add(i);

    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < points.length; j++) {
        if (assigned.has(j)) continue;
        const isNear = cluster.some((idx) => dist(points[idx], points[j]) <= maxDist);
        if (isNear) {
          cluster.push(j);
          assigned.add(j);
          changed = true;
        }
      }
    }

    rawClusters.push(cluster);
  }

  return rawClusters.map((idxList) => {
    const clusterIncidents = idxList.map((idx) => incidents[idx]);
    const clusterPoints = clusterIncidents.map(
      (inc) => [inc.lat, inc.lng] as [number, number]
    );
    const buffered = clusterPoints.flatMap((p) =>
      bufferPoint(p[0], p[1], SECONDARY_RADIUS)
    );
    const polygon = convexHull(buffered);
    if (polygon.length === 0) return null;
    const count = clusterPoints.length;
    const safetyScore = Math.max(10, Math.min(95, 110 - count * 10));

    return {
      id: `cluster-${clusterIncidents[0].id}`,
      incidents: clusterIncidents,
      polygon,
      safetyScore: Math.round(safetyScore),
    };
  }).filter(Boolean) as CrimeCluster[];
}
