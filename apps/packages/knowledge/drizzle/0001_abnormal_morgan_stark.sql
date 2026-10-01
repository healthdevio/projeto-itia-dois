CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "knowledge_bases" RENAME COLUMN "update_at" TO "updated_at";--> statement-breakpoint
ALTER TABLE "knowledge_documents" RENAME COLUMN "creat_at" TO "created_at";--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;