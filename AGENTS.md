# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, Codex, etc.) when working with code in this repository.

## What this is

`multer-gridfs-storage` is a [Multer](https://github.com/expressjs/multer) `StorageEngine` implementation that streams uploaded files straight into MongoDB [GridFS](https://docs.mongodb.com/manual/core/gridfs). It is a library (not an app): the public surface is a single `GridFsStorage` class exported from `src/index.ts`.

- ESM-first (`"type": "module"`); ships a **dual ESM + CommonJS build** via [`tshy`](https://github.com/isaacs/tshy).
- Peer deps drive compatibility: `mongodb ^7.5`, `multer ^2.2`. Requires Node `>=22`.
- Source imports use `.js` extensions on relative paths (nodenext resolution) even though the files are `.ts`. Keep this — dropping the extension breaks the ESM build.

## Commands

Tests need a live MongoDB. Start it first.

```sh
npm run db:up      # start throwaway MongoDB via docker compose (waits until ready)
npm test           # compiles (tshy) then runs vitest once
npm run db:down    # stop + remove the container
```

- **Single test file:** `npx vitest run test/cache-class.spec.ts`
- **By name:** `npx vitest run -t "partial name"`
- **Watch:** `npm run test:watch`
- **Typecheck** (src + test, no emit): `npm run typecheck`
- **Lint/format** (prettier write + eslint fix): `npm run lint`
- **Build:** `npm run compile` (tshy → `dist/esm` + `dist/commonjs`)
- **Coverage:** `npm run coverage`

Notes:
- `npm test` runs `compile` first — a broken build fails the test run before any test executes.
- Vitest is set to `bail: 1` (stops on first failure) with a 30s per-test timeout. Test files run in parallel workers; tests **within** a file run sequentially, which is what keeps shared per-file state safe.
- Default Mongo port is `27017`; docker-compose exposes it and persists nothing (tests create/drop their own databases). `MONGO_PORT` can override the port the tests use.

## Architecture

Four source files under `src/` (plus `src/types/`):

- **`gridfs.ts`** — the engine. `GridFsStorage extends EventEmitter implements StorageEngine`. Implements Multer's `_handleFile` / `_removeFile`. Owns the connection lifecycle and the upload pipeline.
- **`cache.ts`** — `Cache` class, a global connection registry keyed `cacheName → url → optionsIndex`. Lets multiple storages built from the same URL share one MongoClient. Exposed as the static `GridFsStorage.cache`.
- **`utils.ts`** — value-comparison helpers (`compare`, `compareUris`) used by the cache to decide when two URLs / option sets are equivalent, plus `getDatabase` (normalizes a raw `Db`, a Mongoose instance, or a Mongoose connection into a `Db`).
- **`index.ts`** — public exports.

Key behaviors an agent should understand before editing:

1. **Connection is async but the constructor is not.** `new GridFsStorage(...)` kicks off `_connect()` immediately and sets `connecting = true`. Uploads that arrive before the DB is ready are buffered: `_handleFile` awaits `ready()`, which resolves/rejects off the `connection` / `connectionFailed` events. When editing connection logic, preserve this buffering — it is a documented feature.
2. **Three connection modes** via config: `{ url }` (opens its own client, optionally cached), `{ db }` (an existing `Db` or a `Promise<Db>`, also accepts a Mongoose instance/connection), and cached URL reuse. Logic lives in `_resolveConnection` / `_createConnection`.
3. **The default export is a Proxy.** `index.ts` exports `GridFsStorageCtr` (a `Proxy` around the class) as `GridFsStorage` so the engine is callable both with and without `new`. The bare class is re-exported as the type `GridFsStorageInstance`. Don't collapse these.
4. **File naming** (`configuration.file`) may be a plain function, a Promise-returning function, a generator function, or a running generator. `_generate` detects which (via `is-generator`) and, for a generator function, replaces `_file` with its live generator so state persists across files. Returning a string/number is shorthand for `{ filename }`.
5. **Events are the API for observation:** `connection`, `connectionFailed`, `file`, `streamError`, `dbError`. Driver `MongoClient` errors are re-emitted as `dbError`; `close()` detaches those listeners without closing the (possibly shared) connection.
6. **The upload pipe** uses `pump([readStream, ...transforms, writeStream])` so optional user transforms (e.g. encryption) sit between Multer's read stream and the GridFS write stream.

## Conventions

- Prettier + ESLint (flat config, `eslint.config.js`) are the source of truth for style; run `npm run lint` before finishing. `no-explicit-any` is intentionally **off**; unused vars prefixed `_` are ignored.
- Tests are `test/**/*.spec.ts` (vitest + supertest + sinon). Match the existing one-concern-per-file naming (`cache-errors.spec.ts`, `connection-ready.spec.ts`, …).
- Public methods carry JSDoc with `@fires` / `@event` tags — `npm run docs` generates the site from them. Keep doc comments accurate when changing signatures or events.
- `dist/`, `coverage/`, `docs/` are generated; don't hand-edit them.
