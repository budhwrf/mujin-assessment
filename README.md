# AGV Map Editor

An industrial map editor for warehouse AGVs. It loads, edits, validates, and saves an AGV node graph whose JSON remains the source of truth. React and Konva only project that model onto the screen.

## Overview

The editor is a desktop workspace for robotics and warehouse engineering. A map is a list of floor nodes with millimeter coordinates, QR codes, travel directions, and optional charger or chute equipment. AGVs do not travel diagonally. Two nodes connect only when they share an X or Y coordinate and the distance is within `maxNeighborDistance`.

The default map is the assignment sample (`maxNeighborDistance: 1500`, 58 nodes, including `CHUTE`, `READY`, `CHRG1`, and `CHRG2`).

## Project details

This repository is a pnpm workspace. Node.js 22 and pnpm 10.14.0 are required.

| Path                  | Role                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------- |
| `apps/frontend`       | React 19, Vite, Tailwind CSS 4, shadcn/ui, Konva, Zustand, TanStack Query               |
| `apps/backend`        | Fastify REST API, JSON file persistence, and production static hosting                  |
| `packages/map-domain` | Shared types, Zod schemas, direction math, graph derivation, validation, sample fixture |

Local development and Docker do not share ports in the same way:

| Mode                | App                   | API                       |
| ------------------- | --------------------- | ------------------------- |
| `pnpm docker:run`   | http://localhost:8080 | http://localhost:8080/api |
| `pnpm docker:start` | http://localhost:8080 | http://localhost:8080/api |
| `pnpm dev`          | http://localhost:5173 | http://localhost:3000/api |

Do not run the local backend and the Docker app at the same time if both need host port 3000. Docker publishes the single app on port 8080.

Vite proxies `/api` to the local backend. In Docker, Fastify serves the built React app and the `/api` routes from the same origin.

## Architecture and design

The assignment JSON is the source of truth. `@mujin/map-domain` owns the rules. Zustand owns the current edit. Konva only draws that edit. Fastify writes the assignment file back to disk.

The full explanation of each decision, including what was rejected and why, is in [ARCHITECTURE.md](ARCHITECTURE.md). That document covers:

- Why React + Fastify instead of Next.js for this assignment
- Why Konva for the map surface
- Why Zustand for the edit and TanStack Query for the network
- Why `@mujin/map-domain` keeps rules and geometry out of the renderer
- Why the saved file is assignment JSON, not a database or an API wrapper
- Why paths are derived from node directions instead of stored as edges
- Why the compass is the floor frame and is not editable
- Why one Debian image serves both the editor and `/api`

## Features

### Required

- React + TypeScript map editor for the assignment JSON
- Debian Bullseye Docker images
- REST API to load and save maps
- Automated frontend, domain, and backend tests
- Node coordinates, directions, chargers, chutes, and names
- Axis-aligned paths with maximum neighbor distance
- Validation, formatting, download, and import

### Bonus

- Zoom around the cursor, pan, 90-degree viewport rotation, fit, and reset
- Drag nodes with integer millimeter coordinates and optional snap
- Undo/redo for map edits
- Minimap, search, command palette, keyboard shortcuts, autosave, connection status

## Local development

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173.

Other commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
```

Copy `.env.example` if you want to override the API origin, port, or map directory. Leave `VITE_API_URL` empty in local development so the Vite proxy is used.

## Testing

```bash
pnpm test
pnpm test:coverage
```

Domain tests cover axis-aligned connections, diagonal rejection, distance limits, direction vectors, coordinate round-trips, and the sample fixture. Frontend tests cover editing, undo/redo, path creation, and the property panel. Backend tests call the Fastify app in-process for load, create, update, delete, 400, and 404.

## Docker

The image builds from `debian:bullseye`, as required. Fastify serves the React app and the API together. The runtime image contains the `node` binary and the built app only. npm, corepack, and other build tools stay in the build stage so they are not published with the image.

Published image: [`budhwrf/mujin-assessment:latest`](https://hub.docker.com/r/budhwrf/mujin-assessment)

| URL                              | What it is       |
| -------------------------------- | ---------------- |
| http://localhost:8080            | Editor           |
| http://localhost:8080/api/health | API health check |

The process listens on `0.0.0.0` inside the container. The host port is published on `127.0.0.1` only. Map files live in the container `/tmp` volume and are lost when the container is removed.

### Run the published image

Docker must be running. This pulls `budhwrf/mujin-assessment:latest` and starts it. No local build is required.

```bash
pnpm docker:run
```

The same command without pnpm:

```bash
docker pull budhwrf/mujin-assessment:latest

docker run --rm \
  --name mujin-assessment \
  --read-only \
  --tmpfs /tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --user 1001:1001 \
  -p 127.0.0.1:8080:3000 \
  -e HOST=0.0.0.0 \
  -e PORT=3000 \
  -e MAPS_DIR=/tmp/data \
  -e STATIC_DIR=/app/public \
  budhwrf/mujin-assessment:latest
```

Open http://localhost:8080. Stop it with `Ctrl+C` if you started it in the foreground, or:

```bash
docker rm -f mujin-assessment
```

### Build and run locally

This builds the Dockerfile and starts a local image named `mujin-assessment:latest`. `pnpm start` does the same thing.

```bash
pnpm docker:start
```

Stop it with:

```bash
docker rm -f mujin-assessment
```

### Publish

Log in once, then push the local image to Docker Hub:

```bash
docker login
pnpm docker:push
```

That publishes `budhwrf/mujin-assessment:latest`. Pass another username with `pnpm docker:push -- YOUR_DOCKERHUB_USERNAME` if you need to.

## API

| Method   | Path            | Success                                                               |
| -------- | --------------- | --------------------------------------------------------------------- |
| `GET`    | `/`             | `200` editor in Docker, `{ "hello": "world" }` in local API-only mode |
| `GET`    | `/api/health`   | `200`                                                                 |
| `GET`    | `/api/maps`     | `200`                                                                 |
| `GET`    | `/api/maps/:id` | `200`                                                                 |
| `POST`   | `/api/maps`     | `201`                                                                 |
| `PUT`    | `/api/maps/:id` | `200`                                                                 |
| `DELETE` | `/api/maps/:id` | `204`                                                                 |

Invalid payloads return `400`. Unknown ids return `404`. The default seeded id is `warehouse-map-01`.

Save body:

```json
{
  "name": "Warehouse-Map-01",
  "document": {
    "map": {
      "maxNeighborDistance": 1500,
      "nodes": []
    }
  }
}
```

## Map format

```ts
interface AGVNode {
  x: number;
  y: number;
  code: number;
  directions?: Array<"North" | "South" | "East" | "West">;
  charger?: { direction: Direction };
  chute?: { direction: Direction };
  name?: string;
}
```

The file wrapper is `{ "map": AGVMap }`. Directions mean:

| Direction | World      |
| --------- | ---------- |
| North     | positive X |
| South     | negative X |
| West      | positive Y |
| East      | negative Y |

A charger direction is the plug direction. The AGV backs into the charger opposite that plug. A chute direction is the payload ejection direction.

## Known limitations

- Docker map files are stored on the writable `/tmp` filesystem and disappear when the container is removed.
