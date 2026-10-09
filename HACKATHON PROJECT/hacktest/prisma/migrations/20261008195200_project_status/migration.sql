ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";

CREATE TYPE "ProjectStatus" AS ENUM ('CREATED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

ALTER TABLE "Project" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Project"
ALTER COLUMN "status" TYPE "ProjectStatus"
USING (
  CASE "status"::text
    WHEN 'DRAFT' THEN 'CREATED'
    WHEN 'SUBMITTED' THEN 'ACTIVE'
    ELSE "status"::text
  END
)::"ProjectStatus";

ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'CREATED';

DROP TYPE "ProjectStatus_old";
