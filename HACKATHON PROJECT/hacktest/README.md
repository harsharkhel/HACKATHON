# HackPreview backend

The HackPreview backend foundation uses Node.js, TypeScript, Express, PostgreSQL/Prisma, Redis, and Zod. It currently provides configuration, middleware, API versioning, a health endpoint, and a Prisma data model. Authentication and project/judge workflows are not implemented.

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

Project URLs must use HTTPS by default. Set `ALLOW_HTTP_TARGETS=true` only when accepting plain HTTP targets is intentional. Submitted URLs are normalized, DNS-resolved, and rejected if any resolved address is not public. `resolveRedirectTarget` provides checked URL resolution for redirects; any outbound client must disable automatic redirect following, use the resolved addresses when connecting, and validate each redirect before following it. This foundation does not yet make outbound requests or implement health-check/load-test endpoints.

## Project API

All project endpoints require a valid bearer token. Creation, updates, and deletion are participant-only, and project reads and writes are scoped to the authenticated owner:

- `POST /api/v1/projects`
- `GET /api/v1/projects`
- `GET /api/v1/projects/:id`
- `PATCH /api/v1/projects/:id`
- `DELETE /api/v1/projects/:id`

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
  jobs/          Reserved for background jobs
  app.ts         Express configuration
  server.ts      HTTP server bootstrap and shutdown handling
```
