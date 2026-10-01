# Lantern Circuit

Lantern Circuit is a Python learning game. Nia walks the adventure maps. Pebble rolls the robot halls. A short program drives the grid through a replay of what the program did.

Phase 1 ships eight levels in Moss Canopy, Keel Station, and Cinder Dunes. Student Python runs only in the browser, inside a Pyodide worker. There is no custom server.

## Run locally

```bash
npm install
npm run typecheck
npm test
npm run dev
```

- `npm run typecheck` runs `tsc --noEmit`
- `npm test` runs `vitest run`
- `npm run dev` starts Next.js at [http://127.0.0.1:43123](http://127.0.0.1:43123)

Open the home page, pick a level, write Python, and press Run. The first run shows "Loading Python..." while Pyodide loads; the five-second run timer starts only after that.
