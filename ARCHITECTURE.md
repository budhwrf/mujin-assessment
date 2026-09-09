# Architecture and design

This document explains how the AGV Map Editor is built, what each part owns, and why those choices were made. The assignment JSON is the source of truth. Everything else is an editor, a renderer, or a store around that file.

## What the system is

An AGV map is a list of floor nodes. Each node has millimeter coordinates, a QR code, optional travel directions, and optional charger or chute equipment. Two nodes connect only when they share an X or Y coordinate and the distance is within `maxNeighborDistance`. Travel is never diagonal.

The product is a map editor, not a robot runtime. It loads that JSON, lets an operator edit it, validates it, and writes the same shape back.

## Layers

```text
Assignment JSON  { "map": { maxNeighborDistance, nodes } }
        |
        v
@mujin/map-domain     types, Zod, directions, graph, validation
        |
        +--> Fastify          /api/maps, JSON files, static SPA
        |
        +--> Zustand          editor state, undo, viewport, selection
                |
                v
             Konva            canvas projection of the same map
```

| Layer | What it owns | What it does not own |
| --- | --- | --- |
| `@mujin/map-domain` | Assignment rules, schema, path derivation, coordinate math | React, HTTP, files |
| Fastify | Load, save, health, serving the built app | Canvas, undo, selection |
| Zustand | Current edit, tools, history, viewport | Network cache |
| TanStack Query | Load, save, autosave, health | Map rules |
| Konva | Pointers, zoom, pan, drawing | JSON shape |

The frontend and backend both import `@mujin/map-domain`. A rule that lives in one place cannot drift between the editor and the API.

## Request path

Local development runs two processes. Vite serves the editor on port 5173 and proxies `/api` to Fastify on port 3000.

Docker runs one process. Fastify serves the built React app and the API from the same origin. The API stays under `/api` so static routes and map routes do not collide. `GET /` is the editor when `STATIC_DIR` is set, and `{ "hello": "world" }` only when the API is running alone.

```text
Editor action
  -> Zustand updates the in-memory map
  -> export strips editor-only ids
  -> PUT /api/maps/:id
  -> Zod validates the document
  -> id.json is written as assignment JSON
  -> id.meta.json stores name and updatedAt
```

Load Map does the reverse. It fetches the last saved server copy, replaces the editor, and fits the view. It does not open a local file and it discards unsaved edits. File import is a separate action.

## Design decisions

### React + Fastify instead of Next.js

**What.** The editor is a Vite React SPA. The API is a Fastify Node process. In production, Fastify also serves the built SPA. They share `@mujin/map-domain` through the pnpm workspace.

**Why this shape.** The assignment asks for a map editor and a REST API that loads and saves maps. That is two concerns with different lifetimes: a long-lived canvas session on the client, and short request handlers on the server. Splitting them makes ownership obvious. Fastify owns HTTP, validation at the boundary, and the JSON file store. React owns interaction. Neither has to pretend to be the other.

This layout also shows plain Node.js backend work: routes, a file store, CORS, health checks, static hosting, Docker packaging, and in-process API tests. That skill set is what the take-home is meant to demonstrate.

**Honest alternative.** For a project this size, Next.js could have worked. Route Handlers or a Route Handler plus a thin service layer could load and save the same JSON. One framework would mean one `pnpm` app, shared TypeScript types without a workspace package, and a simpler local story. SSR and App Router would not buy much here. The editor is interactive, stateful, and almost entirely client-side. The API is CRUD over files. Next.js would mostly be a bundler and a Node host for that CRUD.

The cost of Next.js here would have been coupling. Map rules would tend to leak into `"use client"` components or into server modules that still import React conventions. A separate Fastify app keeps the backend testable as a Node service and keeps the frontend free to be a canvas app. The workspace package replaces "import from anywhere in the monorepo" with an explicit shared boundary.

**Not chosen.** Express for the API. Fastify is enough of a step up for schema-friendly handlers and a clean plugin model without becoming a framework for the UI.

### Why Konva

**What.** The map surface is a Konva stage. Nodes, paths, arrows, the grid, chargers, chutes, and the minimap are canvas shapes. DOM is used for the shell: sidebars, properties, dialogs, and the JSON panel.

**Why.** An AGV map is a millimeter floor plan. Operators zoom around the cursor, pan empty space, rotate the view 90 degrees, drag nodes, and hit-test small targets. That is canvas work. Konva gives:

- A stage and layers so the grid, paths, and nodes can redraw independently
- Pointer events that map cleanly to world coordinates through `screenToWorld`
- Zoom and pan without remounting hundreds of DOM nodes
- Hit testing that stays accurate while the viewport moves

The important rule is that Konva is a projection. It does not own the map. Domain coordinates stay in Zustand and `@mujin/map-domain`. Screen positions are computed at draw time and never written into the JSON.

**Not chosen.**

- React Flow. It models workflow graphs with library nodes and edges. The assignment model is coordinates and travel directions, not a flowchart. Fighting React Flow's edge model would recreate `deriveEdges` on top of a second source of truth.
- Raw SVG in React. Fine for a static diagram. Expensive for continuous pan, zoom, and drag on dozens of nodes when every transform wants a React render.
- HTML absolute positioning. Fragile for rotation, scale, and hit testing.

### Why Zustand

**What.** One Zustand store holds the editable map, selection, active tool, undo and redo stacks, viewport, snap and grid flags, and dirty or save status.

**Why.** Canvas editing is high-frequency and local. Dragging a node, hovering a path, or undoing a delete should not go through a remote cache. Zustand gives:

- Synchronous updates during pointer moves
- Selectors so the canvas and the property panel subscribe to different slices
- An explicit history array for undo without middleware theater
- A place for editor-only state that must never be saved: viewport, selection, tool, temporary path-start id

TanStack Query still owns the network. It loads the saved map, saves and autosaves, and polls health. The boundary is intentional. Query answers "what did the server last accept." Zustand answers "what is the operator looking at and changing right now."

**Not chosen.**

- Redux Toolkit. Correct, but heavier for one editor surface. The action and slice ceremony does not pay for itself here.
- React Context alone. Frequent viewport and hover updates would re-render large trees unless every consumer is carefully memoized.
- Putting the live map in TanStack Query. That would treat each drag frame like a mutation or cache write.

### Why `@mujin/map-domain` is a separate package

**What.** `packages/map-domain` is a framework-free TypeScript package. It owns types, Zod schemas, direction vectors, geometry, connection checks, edge derivation, validation, assignment export, and the sample fixture. The frontend and backend depend on it. Neither owns the rules alone.

**Why.** Render logic and domain logic have different jobs.

| Concern | Belongs in |
| --- | --- |
| Can these two nodes connect? | `@mujin/map-domain` |
| What edges does this map imply? | `@mujin/map-domain` |
| Is this JSON valid for save? | `@mujin/map-domain` |
| How do world millimeters become screen pixels? | `@mujin/map-domain` geometry helpers, called by the canvas |
| Which Konva shape draws a charger? | frontend |
| Which button deletes a node? | frontend |
| Which file path stores `warehouse-map-01`? | backend |

Keeping the package separate forces that split. The canvas can be rewritten, or the API can change transport, without rewriting the AGV rules. The same `canConnect` and `validateDocument` run in the property panel, the JSON inspector, and Fastify. Tests cover the sample map and the connection rules with Vitest and no browser.

Geometry helpers such as `worldToScreen` and `fitViewport` live in the domain package even though they sound like UI. They are pure transforms over assignment coordinates and a viewport record. Putting them next to `deriveEdges` keeps the coordinate frame consistent. Konva still decides what to draw; it does not invent the math.

**Not chosen.** Duplicating types in `apps/frontend` and `apps/backend`, or importing backend files from the frontend. Duplication drifts. Cross-app imports create a fake package with no clear public API.

### The assignment file is the persisted model

**What.** Saved maps are `{ "map": { "maxNeighborDistance", "nodes" } }`. Node fields are `x`, `y`, `code`, `directions`, and optional `name`, `charger`, and `chute`. Empty optional fields and editor ids are omitted.

**Why.** The assignment defines that file as the contract. A wrapper with `id`, `name`, and `updatedAt` inside the map file would be easier for the API and wrong for the consumer. Name and timestamp live in a sidecar `id.meta.json` so the map file stays assignment-shaped. The store still accepts the older wrapped format when reading, so older local files do not break.

**Not chosen.** SQLite or a document database. The delivered image is read-only except for `/tmp`. A JSON directory needs no native module, no volume, and no schema migration. The cost is that Docker saves disappear when the container is removed. That is acceptable for this assignment.

### Editor ids stay out of the file

**What.** While editing, each node has a stable `id` used for selection, drag, undo, and path identity. `toDocument()` strips those ids before save, download, or the JSON inspector.

**Why.** The assignment nodes have no id field. Inventing one in the saved file would change the contract. Keeping ids only in memory still lets the UI address a node without using array index, which changes when nodes are added or deleted.

### Paths are derived, not stored

**What.** A path is not a row in the JSON. `deriveEdges()` walks each node's `directions`, finds the nearest axis-aligned neighbor within `maxNeighborDistance`, and draws that edge. Add Path writes the matching directions onto both nodes. Delete Path removes them.

**Why.** The file describes where an AGV is allowed to leave a node, not a separate edge list. Storing edges as well would create two sources of truth that can disagree. Bidirectional travel is two direction entries, one on each node. A one-way path is a direction on only one node. A closer node on the same line blocks a farther one, so a direction cannot jump over an intermediate node.

**Not chosen.** React Flow edges or a stored `edges` array. Those are convenient for a graph UI and incorrect for this file.

### The compass is the assignment frame, not screen north

**What.** North is positive X. South is negative X. West is positive Y. East is negative Y. At rotation 0, positive X is drawn up and positive Y is drawn left. Rotating the view turns the viewport in 90-degree steps. JSON coordinates do not change. The compass points at positive X.

**Why.** AGV maps use a floor frame, not a screen frame. If rotation rewrote `x` and `y`, a save after a view change would silently move the warehouse. The compass is a readout of that frame. It is not an editable property.

### One schema, two validation moments

**What.** Zod parses the document shape. `validateMap()` then checks assignment rules: duplicate codes, diagonal connections implied by directions, and neighbors beyond `maxNeighborDistance`. The server rejects an invalid payload with `400` before it replaces a file.

**Why.** Shape errors and rule errors are different. A missing `x` is a schema failure. Two nodes that do not share an axis is a map failure. Doing both on the server means a bad import cannot overwrite a good save even if the client is bypassed.

### One Debian image, Fastify serves both

**What.** The Dockerfile is `debian:bullseye`. The runtime image copies the `node` binary and the built app. npm, corepack, and the package manager stay in the build stage. Fastify listens on port 3000 inside the container. The host publishes `127.0.0.1:8080`. `MAPS_DIR=/tmp/data` and `STATIC_DIR=/app/public`. The process runs as uid 1001, read-only, with a tmpfs on `/tmp`, all capabilities dropped.

**Why.** The requirement is a Debian Bullseye image and a `docker run` command, not Compose. One process avoids a second web server, a reverse proxy, and a split origin for the editor and the API. `/api` stays the API prefix so the SPA fallback cannot swallow map routes.

Copying only `node` keeps build-tool packages out of the published image. That is why Scout findings from npm and tar were not "fixed" by leaving those tools in the runtime stage.

**Not chosen.** Two images, nginx in front of the API, or Docker Compose. Those add moving parts the requirement does not ask for.

### UI tokens, not one-off colors

**What.** The shell uses shadcn/ui and Tailwind semantic tokens under a `.dark` class. Panels, dialogs, and the canvas chrome share those tokens.

**Why.** Custom CSS colors drifted from the dialogs and left light surfaces on a dark editor. Semantic tokens keep one theme. Konva still needs explicit canvas colors because it does not read CSS variables the way DOM nodes do. Those values are isolated to the canvas color map.

### Sample map is a fixture, not hardcoded UI data

**What.** The 58-node assignment sample, including `CHUTE`, `READY`, `CHRG1`, and `CHRG2`, lives in `@mujin/map-domain`. The backend seeds `warehouse-map-01` from that fixture when the data directory is empty.

**Why.** The editor, the seed file, and the tests should start from the same map. Duplicating the sample in the frontend would let the UI and the API disagree about the default warehouse.

## What was deliberately left out

- No robot execution, traffic control, or path planning beyond neighbor derivation.
- No authentication. The API is a local editor backend.
- No database and no multi-user locking.
- No editable compass and no rewrite of coordinates when the view rotates.
- No Docker Compose. The requirement is a Dockerfile and `docker run`.

## How to read the code

| Path | Start here if you want |
| --- | --- |
| `packages/map-domain/src/graph.ts` | Connection rules and assignment export |
| `packages/map-domain/src/directions.ts` | North/South/East/West vectors |
| `packages/map-domain/src/geometry.ts` | Screen projection, fit, snap |
| `packages/map-domain/src/validation.ts` | Schema plus map rules |
| `apps/backend/src/maps/store.ts` | How JSON files are written |
| `apps/frontend/src/store/map-editor-store.ts` | Edit, undo, viewport |
| `apps/frontend/src/components/map/map-canvas.tsx` | Konva projection |
| `Dockerfile` | Single-image runtime |
