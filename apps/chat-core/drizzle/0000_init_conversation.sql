CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"state" text DEFAULT 'greeting' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"conversation_id" text NOT NULL,
	"message_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"origin" text NOT NULL,
	"metadata" text,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_conversation_id_message_id_pk" PRIMARY KEY("conversation_id","message_id"),
	CONSTRAINT "messages_role_check" CHECK ("messages"."role" in ('user', 'assistant'))
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_user_single_active_idx" ON "conversations" USING btree ("user_id","is_active") WHERE "conversations"."is_active" = true;--> statement-breakpoint
CREATE INDEX "conversations_user_updated_at_idx" ON "conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_date_idx" ON "messages" USING btree ("conversation_id","date");