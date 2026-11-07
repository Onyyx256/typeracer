CREATE TABLE "texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" text NOT NULL,
	"content" text NOT NULL,
	"word_count" integer NOT NULL,
	"complexity" text NOT NULL,
	"has_digits" boolean NOT NULL,
	"source_title" text NOT NULL,
	"source_author" text NOT NULL,
	"source_ref" text NOT NULL,
	CONSTRAINT "texts_language" CHECK ("texts"."language" in ('fr', 'en')),
	CONSTRAINT "texts_complexity" CHECK ("texts"."complexity" in ('easy', 'medium', 'hard'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "texts_source_ref_idx" ON "texts" USING btree ("source_ref");--> statement-breakpoint
CREATE INDEX "texts_language_complexity_idx" ON "texts" USING btree ("language","complexity");