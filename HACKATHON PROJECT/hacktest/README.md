# HackPreview backend

The HackPreview backend uses Node.js, TypeScript, Express, PostgreSQL/Prisma, Redis/BullMQ, and Zod to provide authentication, project management, previews, health checks, QR/device sessions, and controlled load tests.

## Requirements

- Node.js 22 or later and npm
- Docker with the Compose plugin (for PostgreSQL and Redis)

## Install

```sh
npm install
cp .env.example .env
```

The example environment points at local PostgreSQL and Redis instances. Edit `.env` if your local connection settings differ, and set a generated `JWT_SECRET` before starting the API or Compose stack. Environment values are parsed and validated by `src/config/env.ts` when the application starts.

## Database schema and seed

The Prisma schema is in `prisma/schema.prisma`. Generate the client and apply migrations with:

```sh
npm run db:generate
npm run db:migrate
```

The initial schema migration is checked in at `prisma/migrations/20261008193100_init`. For an already provisioned database in a deployment, apply checked-in migrations with `npm run db:migrate:deploy`.

Seed a local database with one demo user and project using `npm run db:seed` (or `npx prisma db seed`). The seed account has no usable password hash and is not an authentication account.

Project URLs must use HTTPS by default. Set `ALLOW_HTTP_TARGETS=true` only when accepting plain HTTP targets is intentional. Submitted URLs are normalized, DNS-resolved, and rejected if any resolved address is not public.

## Project API

All project endpoints require a valid bearer token. Creation, updates, and deletion are participant-only, and project reads and writes are scoped to the authenticated owner:

- `POST /api/v1/projects`
- `GET /api/v1/projects`
- `GET /api/v1/projects/:id`
- `PATCH /api/v1/projects/:id`
- `DELETE /api/v1/projects/:id`
- `POST /api/v1/projects/:id/health-check`
- `GET /api/v1/projects/:id/health-checks`
- `POST /api/v1/projects/:id/qr?format=png|svg`
- `DELETE /api/v1/projects/:id/qr/:qrSessionId` (revoke a QR token)
- `POST /api/v1/projects/:id/load-tests`
- `GET /api/v1/projects/:id/load-tests`
- `GET /api/v1/load-tests/:id`
- `POST /api/v1/load-tests/:id/cancel`
- `GET /api/v1/load-tests/:id/stream` (authenticated Server-Sent Events)
- `POST /api/v1/sessions/:id/device-info`
- `GET /api/v1/projects/:id/devices` (project owner)
- `GET /api/v1/judge/projects/:id`
- `GET /api/v1/judge/projects/:id/health`
- `GET /api/v1/judge/projects/:id/load-tests`
- `GET /api/v1/judge/projects/:id/devices`

Health checks re-resolve and pin public addresses at connect time, validate every redirect, limit the redirect chain to five hops, use a seven-second total deadline, perform at most one retry, and cap concurrent checks. Every result (including network failures) is persisted in PostgreSQL; history returns the latest 50 checks.

QR tokens contain 256 bits of random entropy, are stored as SHA-256 hashes, and expire after 30 minutes. QR payloads contain only a public `/p/{token}` URL. The public preview routes are:

- `GET /api/v1/qr/:token`
- `POST /api/v1/qr/:token/connect`

Device-session routes are:

- `POST /api/v1/sessions/connect` with `{ "token": "<qr-token>" }`
- `GET /api/v1/sessions/:id`
- `POST /api/v1/sessions/:id/heartbeat`
- `DELETE /api/v1/sessions/:id`

Device sessions expire after 30 minutes without a heartbeat. Redis tracks active sessions with TTLs, while PostgreSQL stores session/device analytics. Protected routes can use `requireActiveProjectSession` and the `X-Project-Session-Id` header.

The phone preview endpoint is `GET /api/v1/preview/:sessionToken`. The QR token authorizes only the project's name, description, public URL, latest health status/latency, and token expiry. The API returns metadata only: clients navigate to the project URL directly; HackPreview does not proxy project traffic. CORS is restricted to `CORS_ORIGINS`, and preview responses are private, non-cacheable, and non-indexable.

Load-test creation accepts optional `concurrency` (default 100, maximum 500), `durationSeconds` (default 30, maximum 60), and `maxRequests` (default 10,000, maximum 10,000). Only one active test is allowed per project; the queue has a 100-job backlog limit and creation is rate-limited. Target requests run only in the separate Redis/BullMQ worker, which revalidates and pins public DNS addresses, times out each request after five seconds, and never buffers response bodies.

Start the worker separately from the API:

```sh
npm run build
npm run worker
```

For development, run `npm run worker:dev` in another terminal. BullMQ retries failed jobs once, recovers stalled jobs, and worker shutdown requests cancellation of its active test. Results include total/successful/failed requests, average/median/p95/p99 latency, RPS, error rate, status and error distributions, and duration.

The Compose stack starts `api` and `load-test-worker` as separate services. The worker is constrained to one CPU and 512 MiB in the supplied Compose configuration.

Load-test SSE streams require the same bearer authorization as the load-test record; the latest Redis snapshot is sent immediately on connection/reconnection, heartbeats are sent every 15 seconds, and terminal events close the stream. Judge project endpoints require a `JUDGE` bearer token and an active `X-Project-Session-Id` whose QR-created device session belongs to the requested project.

Device compatibility metadata is submitted to `/api/v1/sessions/:id/device-info` from an active device session. Viewport dimensions and coarse connection metrics are range-limited; supported device summaries omit IP addresses and raw user-agent strings.

Run the API authorization and URL security tests with `npm test`.

Generate a JWT secret for local development with:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

## Start PostgreSQL and Redis

Start just the dependencies:

```sh
docker compose up -d postgres redis
```

Check their status:

```sh
docker compose ps
```

To build and run the API together with both dependencies instead, use `docker compose up --build`.

## Start the API

With the dependencies running in Docker:

```sh
npm run dev
```

The development server listens on `http://localhost:3000`. Build and run the compiled server with:

```sh
npm run build
npm start
```

## Health check

```sh
curl --fail http://localhost:3000/api/v1/health
```

The endpoint returns HTTP 200 and a JSON status payload. It is a liveness check and does not currently test database or Redis connectivity.

## Source layout

```text
src/
  config/        Environment, database, and Redis configuration
  controllers/   HTTP request handlers
  middleware/    Security, validation, error, rate-limit, and request logging
  models/        Reserved for domain model definitions
  routes/        Versioned API route definitions
  services/      Reserved for application services
  types/         Shared TypeScript declarations
  utils/         Shared utilities and logging
  validators/    Reserved for request schemas
  modules/load-tests/  Load-test API, metrics, and worker execution
  workers/       Standalone BullMQ workers
  app.ts         Express configuration
  server.ts      HTTP server bootstrap and shutdown handling
```
