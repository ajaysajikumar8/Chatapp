-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_deleted_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_deleted_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_deleted_messages_user_id_message_id_key" ON "user_deleted_messages"("user_id", "message_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_attachment_url_created_at_idx" ON "messages"("conversation_id", "attachment_url", "created_at");

-- AddForeignKey
ALTER TABLE "user_deleted_messages" ADD CONSTRAINT "user_deleted_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_deleted_messages" ADD CONSTRAINT "user_deleted_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
