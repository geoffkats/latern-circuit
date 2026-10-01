# Lantern Circuit

Lantern Circuit is a Python learning game. A student writes a short program. Nia walks the adventure maps, and Pebble rolls the robot halls. The picture on the grid is a replay of that program, not a second copy of the rules.

This stage is the simulator only: pure TypeScript for moves, turns, items, sensors, faults, and win checks. Level JSON, the Pyodide worker, and the player UI are later stages. Student Python does not run here, and there is no custom server.

## Run tests locally

```bash
npm install
npx tsc --noEmit
npx vitest run
```

`npm run typecheck` and `npm test` run those same two checks. `npm run dev` starts Next.js at <http://127.0.0.1:43123>.
