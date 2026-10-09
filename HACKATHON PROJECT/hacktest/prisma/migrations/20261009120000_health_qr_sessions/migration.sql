ALTER TABLE "HealthCheck"
  RENAME COLUMN "errorMessage" TO "errorReason";

ALTER TABLE "HealthCheck"
  ADD COLUMN "dnsResolutionTime" DOUBLE PRECISION,
  ADD COLUMN "tlsSuccess" BOOLEAN,
  ADD COLUMN "redirectCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "finalUrl" TEXT;

ALTER TABLE "QRSession"
  RENAME COLUMN "qrToken" TO "qrTokenHash";

DELETE FROM "QRSession";

DROP INDEX "QRSession_qrToken_key";
CREATE UNIQUE INDEX "QRSession_qrTokenHash_key" ON "QRSession"("qrTokenHash");

ALTER TABLE "QRSession"
  ADD COLUMN "revokedAt" TIMESTAMPTZ(3);
