-- AlterTable
ALTER TABLE "users" DROP COLUMN "display_name",
DROP COLUMN "is_discoverable",
DROP COLUMN "last_seen",
DROP COLUMN "status",
DROP COLUMN "username",
ADD COLUMN "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
