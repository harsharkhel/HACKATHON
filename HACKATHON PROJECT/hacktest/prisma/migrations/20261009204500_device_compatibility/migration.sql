ALTER TABLE "DeviceSession"
  ADD COLUMN "viewportWidth" INTEGER,
  ADD COLUMN "viewportHeight" INTEGER,
  ADD COLUMN "connectionType" TEXT,
  ADD COLUMN "effectiveType" TEXT,
  ADD COLUMN "downlinkMbps" DOUBLE PRECISION,
  ADD COLUMN "roundTripTimeMs" INTEGER;

CREATE INDEX "DeviceSession_deviceType_browser_operatingSystem_idx"
  ON "DeviceSession"("deviceType", "browser", "operatingSystem");
