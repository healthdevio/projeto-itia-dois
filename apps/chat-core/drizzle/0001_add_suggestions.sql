CREATE TABLE "suggestions" (
	"conversation_id" text NOT NULL,
	"suggestion_id" text NOT NULL,
	"text" text NOT NULL,
	"position" integer NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suggestions_conversation_id_suggestion_id_pk" PRIMARY KEY("conversation_id","suggestion_id")
);
--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "suggestions_conversation_position_idx" ON "suggestions" USING btree ("conversation_id","position");