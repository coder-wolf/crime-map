# Crime Map

An interactive crime heatmap built with Next.js. Report incidents by clicking on the map — nearby reports auto-cluster into color-coded polygons using an amber-red heat spectrum.

**Live:** [crime-map-theta.vercel.app](https://crime-map-theta.vercel.app)

---

## Features

- **Click-to-report** — tap anywhere on the map to open a popup, select crime type and recency, then place the marker
- **Emoji markers** — each incident shows a crime-type emoji instead of a generic dot
- **Auto-clustering** — incidents within ~110m group together and form a convex hull polygon
- **Heatmap coloring** — polygons are colored amber→orange→red based on incident density (never green — fewer crimes ≠ "safe")
- **Dual-radius view** — each incident shows a primary radius (visible zone) and a secondary radius (used for polygon computation)
- **Dynamic sidebar** — location label updates as you pan/zoom; cluster list filters to only what's visible in the viewport
- **Area Report card** — floating bottom-right card shows live stats (count by crime type, recency, overall area score) filtered to the current viewport
- **Persistent storage** — incidents are stored in MongoDB and survive page reloads

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Map | [Leaflet](https://leafletjs.com/) + [React-Leaflet](https://react-leaflet.js.org/) |
| Database | MongoDB (via `mongodb` driver) |
| Deployment | [Vercel](https://vercel.com/) |

## Getting Started

### Prerequisites

- Node.js >= 18
- A MongoDB instance (Atlas or local)

### Setup

```bash
git clone <repo-url>
cd crime-map
npm install
```

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<name>
DB_NAME=crime-map
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## How It Works

1. **Reporting** — Click "+ Report Incident" in the sidebar, then click the map. A popup appears asking for the crime type (with emoji) and recency (Today → Older)
2. **Clustering** — Every incident generates 12 buffer points around it at the secondary radius distance. Nearby incidents form groups using single-linkage clustering
3. **Polygon generation** — Each cluster's buffer points are fed through Andrew's monotone chain convex hull algorithm to produce the enclosing polygon
4. **Coloring** — Absolute incident count determines the score using an amber-red heat spectrum (red = dense, amber = sparse)
5. **Reporting card** — A floating card in the bottom-right shows live statistics for the currently visible area, updating on every pan/zoom
6. **Persistence** — Incidents are sent to a MongoDB collection via the `/api/incidents` REST endpoint

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/incidents` | Fetch all incidents |
| `POST` | `/api/incidents` | Create a new incident |
| `DELETE` | `/api/incidents` | Clear all incidents |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `DB_NAME` | No | Database name (default: `crime-map`) |

## Deployment

The project is designed to deploy seamlessly on Vercel. Set `MONGODB_URI` and `DB_NAME` as environment variables in the Vercel dashboard or CLI, then:

```bash
vercel --prod
```

---

Built with Next.js, Leaflet, and MongoDB.
