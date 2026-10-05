-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterEnum
BEGIN;
-- Preserve existing memberships by mapping the removed role before changing the enum type.
UPDATE "WorkspaceMember" SET "role" = 'MEMBER' WHERE "role" = 'ADMIN';
CREATE TYPE "WorkspaceRole_new" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');
ALTER TABLE "WorkspaceMember" ALTER COLUMN "role" TYPE "WorkspaceRole_new" USING ("role"::text::"WorkspaceRole_new");
ALTER TYPE "WorkspaceRole" RENAME TO "WorkspaceRole_old";
ALTER TYPE "WorkspaceRole_new" RENAME TO "WorkspaceRole";
DROP TYPE "public"."WorkspaceRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE';
