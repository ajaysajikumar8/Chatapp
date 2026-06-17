-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachment_name" TEXT,
ADD COLUMN     "attachment_type" TEXT,
ADD COLUMN     "attachment_url" TEXT,
ALTER COLUMN "content" DROP NOT NULL;
