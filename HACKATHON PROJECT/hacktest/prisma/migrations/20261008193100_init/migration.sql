-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PARTICIPANT', 'JUDGE', 'ORGANIZER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LoadTestStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PARTICIPANT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "projectUrl" TEXT NOT NULL,
    "repositoryUrl" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSession" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSession" (
    "id" UUID NOT NULL,
    "projectSessionId" UUID NOT NULL,
    "deviceType" TEXT NOT NULL,
    "browser" TEXT,
    "operatingSystem" TEXT,
    "ipAddress" INET,
    "userAgent" TEXT,
    "connectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "responseTime" DOUBLE PRECISION,
    "isHealthy" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "checkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadTest" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "concurrentUsers" INTEGER NOT NULL,
    "successfulRequests" INTEGER NOT NULL DEFAULT 0,
    "failedRequests" INTEGER NOT NULL DEFAULT 0,
    "averageResponseTime" DOUBLE PRECISION,
    "p95ResponseTime" DOUBLE PRECISION,
    "p99ResponseTime" DOUBLE PRECISION,
    "requestsPerSecond" DOUBLE PRECISION,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "status" "LoadTestStatus" NOT NULL DEFAULT 'QUEUED',

    CONSTRAINT "LoadTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRSession" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "qrToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Project_status_createdAt_idx" ON "Project"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSession_sessionToken_key" ON "ProjectSession"("sessionToken");

-- CreateIndex
CREATE INDEX "ProjectSession_projectId_expiresAt_idx" ON "ProjectSession"("projectId", "expiresAt");

-- CreateIndex
CREATE INDEX "DeviceSession_projectSessionId_lastSeenAt_idx" ON "DeviceSession"("projectSessionId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "HealthCheck_projectId_checkedAt_idx" ON "HealthCheck"("projectId", "checkedAt");

-- CreateIndex
CREATE INDEX "LoadTest_projectId_startedAt_idx" ON "LoadTest"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "LoadTest_status_startedAt_idx" ON "LoadTest"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QRSession_qrToken_key" ON "QRSession"("qrToken");

-- CreateIndex
CREATE INDEX "QRSession_projectId_expiresAt_idx" ON "QRSession"("projectId", "expiresAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSession" ADD CONSTRAINT "ProjectSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_projectSessionId_fkey" FOREIGN KEY ("projectSessionId") REFERENCES "ProjectSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadTest" ADD CONSTRAINT "LoadTest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRSession" ADD CONSTRAINT "QRSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
