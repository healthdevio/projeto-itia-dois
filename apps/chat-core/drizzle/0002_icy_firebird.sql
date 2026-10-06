ALTER TABLE "messages" DROP CONSTRAINT "messages_role_check";--> statement-breakpoint
UPDATE "messages" SET "role" = 'assistant' WHERE "role" = 'mia';--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_role_check" CHECK ("messages"."role" in ('user', 'assistant'));