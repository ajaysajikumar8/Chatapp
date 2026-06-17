-- CreateEnum
CREATE TYPE "PrivacyVisibility" AS ENUM ('EVERYONE', 'CONTACTS', 'NOBODY');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "muted_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "profile_photo_url" TEXT,
    "bio" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "last_seen" TIMESTAMP(3),

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_discoverable" BOOLEAN NOT NULL DEFAULT true,
    "read_receipts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_visibility" "PrivacyVisibility" NOT NULL DEFAULT 'EVERYONE',
    "profile_photo_visibility" "PrivacyVisibility" NOT NULL DEFAULT 'EVERYONE',
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notification_sound_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_type" TEXT,
    "browser_name" TEXT,
    "os_name" TEXT,
    "ip_address" TEXT,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_username_key" ON "user_profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing users into user_profiles
INSERT INTO "user_profiles" ("id", "user_id", "username", "display_name", "status", "last_seen")
SELECT 'up_' || "id", "id", "username", "display_name", "status", "last_seen" FROM "users";

-- Backfill existing users into user_settings
INSERT INTO "user_settings" ("id", "user_id", "is_discoverable", "read_receipts_enabled", "last_seen_visibility", "profile_photo_visibility", "notifications_enabled", "notification_sound_enabled")
SELECT 'us_' || "id", "id", "is_discoverable", TRUE, 'EVERYONE', 'EVERYONE', TRUE, TRUE FROM "users";
