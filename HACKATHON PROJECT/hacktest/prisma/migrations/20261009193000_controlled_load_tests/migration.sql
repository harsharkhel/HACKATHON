ALTER TABLE "LoadTest"
  ADD COLUMN "durationSeconds" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "maxRequests" INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN "medianResponseTime" DOUBLE PRECISION,
  ADD COLUMN "errorRate" DOUBLE PRECISION,
  ADD COLUMN "httpStatusDistribution" JSONB,
  ADD COLUMN "errorDistribution" JSONB,
  ADD COLUMN "durationMs" INTEGER,
  ADD COLUMN "errorMessage" TEXT,
  ADD COLUMN "cancelRequestedAt" TIMESTAMPTZ(3),
  ADD COLUMN "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "LoadTest"
  ALTER COLUMN "startedAt" DROP NOT NULL,
  ALTER COLUMN "startedAt" DROP DEFAULT;

DROP INDEX "LoadTest_projectId_startedAt_idx";
CREATE INDEX "LoadTest_projectId_createdAt_idx" ON "LoadTest"("projectId", "createdAt");

CREATE UNIQUE INDEX "LoadTest_one_active_per_project_idx"
  ON "LoadTest"("projectId")
  WHERE "status" IN ('QUEUED', 'RUNNING');
