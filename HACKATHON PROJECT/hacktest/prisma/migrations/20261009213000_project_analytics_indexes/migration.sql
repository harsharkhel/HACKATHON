CREATE INDEX "ProjectSession_projectId_createdAt_idx"
ON "ProjectSession"("projectId", "createdAt");

CREATE INDEX "DeviceSession_projectSessionId_connectedAt_idx"
ON "DeviceSession"("projectSessionId", "connectedAt");
