CREATE TABLE "race_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"race_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"is_guest" boolean NOT NULL,
	"rank" integer NOT NULL,
	"status" text NOT NULL,
	"wpm" real NOT NULL,
	"raw_wpm" real NOT NULL,
	"accuracy" real NOT NULL,
	"errors" integer NOT NULL,
	"progress" real NOT NULL,
	"duration_ms" integer NOT NULL,
	"wpm_series" jsonb NOT NULL,
	"missed_keys" jsonb NOT NULL,
	CONSTRAINT "race_results_rank" CHECK ("race_results"."rank" >= 1),
	CONSTRAINT "race_results_status" CHECK ("race_results"."status" in ('finished', 'timeUp', 'abandoned')),
	CONSTRAINT "race_results_progress" CHECK ("race_results"."progress" between 0 and 1),
	CONSTRAINT "race_results_accuracy" CHECK ("race_results"."accuracy" between 0 and 100),
	CONSTRAINT "race_results_guest_has_no_user" CHECK (not ("race_results"."is_guest" and "race_results"."user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "races" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid,
	"text_id" uuid,
	"content" text NOT NULL,
	"config" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	CONSTRAINT "races_ended_after_start" CHECK ("races"."ended_at" >= "races"."started_at")
);
--> statement-breakpoint
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_text_id_texts_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."texts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "race_results_race_rank_idx" ON "race_results" USING btree ("race_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "race_results_race_user_idx" ON "race_results" USING btree ("race_id","user_id");--> statement-breakpoint
CREATE INDEX "race_results_user_idx" ON "race_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "races_room_ended_idx" ON "races" USING btree ("room_id","ended_at");