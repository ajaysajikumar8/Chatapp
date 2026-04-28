-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_seen" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OFFLINE';
