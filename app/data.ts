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
  { id: 'today', label: 'Today', color: '#ef4444' },
  { id: '1week', label: '1 Week', color: '#f97316' },
  { id: '1month', label: '1 Month', color: '#fde047' },
  { id: '6months', label: '6 Months', color: '#84cc16' },
  { id: '1year', label: '1 Year', color: '#4ade80' },
  { id: 'older', label: 'Older', color: '#22c55e' },
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
  const hue = (score / 100) * 45;
  return `hsl(${hue}, 80%, 50%)`;
}

export function getSafetyLabel(score: number): string {
  if (score >= 80) return 'Very Low Crime';
  if (score >= 60) return 'Low Crime';
  if (score >= 40) return 'Moderate Crime';
  if (score >= 20) return 'High Crime';
  return 'Very High Crime';
}

export function getRecencyColor(age: string): string {
  switch (age) {
    case 'today':
      return '#ef4444';
    case '1week':
      return '#f97316';
    case '1month':
      return '#fde047';
    case '6months':
      return '#84cc16';
    case '1year':
      return '#4ade80';
    case 'older':
      return '#22c55e';
    default:
      return '#22c55e';
  }
}

const DUMMY_DESCRIPTIONS: Record<string, string[]> = {
  theft: ['Wallet stolen from bag', 'Phone snatched on sidewalk', 'Bicycle taken from rack', 'Package stolen from porch'],
  robbery: ['Armed robbery at convenience store', 'Mugging on dark street', 'Bank robbery suspect seen fleeing'],
  assault: ['Physical altercation outside bar', 'Person attacked in parking lot', 'Schoolyard fight turned violent'],
  burglary: ['Apartment broken into during day', 'House burglary through back window', 'Office equipment stolen overnight'],
  vandalism: ['Car window smashed', 'Graffiti on building wall', 'Street sign damaged'],
  murder: ['Suspicious death under investigation', 'Shooting victim found in alley', 'Stabbing reported in residence'],
  drugs: ['Suspected drug deal observed', 'Found drug paraphernalia in park', 'Suspicious chemical odor reported'],
  fraud: ['Credit card scam reported', 'Phishing email targeting residents', 'Fake charity collection spotted'],
  other: ['Suspicious activity reported', 'Noise complaint with possible crime', 'Welfare check requested'],
};

const DUMMY_REPORTERS = [
  'Anonymous Citizen', 'Local Resident', 'Neighborhood Watch', 'Security Guard',
  'Shop Owner', 'Bystander', 'Off-duty Officer', 'Community Member',
];

const DUMMY_STATUSES = ['Under Investigation', 'Active Case', 'Pending Review', 'Open'];

export function getIncidentDetails(inc: Incident) {
  const descs = DUMMY_DESCRIPTIONS[inc.crimeType] ?? DUMMY_DESCRIPTIONS.other;
  const desc = descs[parseInt(inc.id.slice(-1), 16) % descs.length] ?? descs[0];
  const reporter = DUMMY_REPORTERS[parseInt(inc.id.slice(-2), 36) % DUMMY_REPORTERS.length] ?? DUMMY_REPORTERS[0];
  const status = DUMMY_STATUSES[parseInt(inc.id.slice(-1), 16) % DUMMY_STATUSES.length] ?? DUMMY_STATUSES[0];

  const now = new Date();
  const ageDays: Record<string, number> = { today: 0, '1week': 3, '1month': 15, '6months': 90, '1year': 180, older: 365 };
  const daysAgo = ageDays[inc.age] ?? 0;
  const incidentDate = new Date(now.getTime() - daysAgo * 86400000 - Math.floor(Math.random() * 86400000));

  return { description: desc, reportedBy: reporter, date: incidentDate, status, caseNumber: `CR-${inc.id.slice(-6).toUpperCase()}` };
}

function isValidCoord(v: number): boolean {
  return Number.isFinite(v);
}

function isValidPoint(p: [number, number]): boolean {
  return isValidCoord(p[0]) && isValidCoord(p[1]);
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

    let centroid = points[i];
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < points.length; j++) {
        if (assigned.has(j)) continue;
        if (dist(centroid, points[j]) <= maxDist) {
          cluster.push(j);
          assigned.add(j);
          changed = true;
        }
      }
      if (changed) {
        const sum = cluster.reduce((acc, idx) => [acc[0] + points[idx][0], acc[1] + points[idx][1]], [0, 0]);
        centroid = [sum[0] / cluster.length, sum[1] / cluster.length];
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
    ).filter(isValidPoint);
    const polygon = convexHull(buffered);
    if (polygon.length < 3) return null;
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

export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if ((yi > point[1]) !== (yj > point[1]) &&
        point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function metersToDeg(meters: number): number {
  return meters / 111320;
}

const locationNameCache = new Map<string, string>();

export async function fetchLocationName(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = locationNameCache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&accept-language=en`,
      { headers: { 'User-Agent': 'CrimeMap/1.0' } }
    );
    if (!res.ok) throw new Error('Nominatim request failed');
    const data = await res.json();
    const parts = (data.display_name ?? '').split(', ');
    const name = parts.slice(0, 2).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    locationNameCache.set(key, name);
    return name;
  } catch {
    const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    locationNameCache.set(key, fallback);
    return fallback;
  }
}
