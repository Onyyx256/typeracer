ALTER TABLE "race_results" ALTER COLUMN "accuracy" DROP NOT NULL;--> statement-breakpoint
-- Races already played: whoever gave up loses their accuracy too.
UPDATE "race_results" SET "accuracy" = NULL WHERE "status" = 'abandoned';--> statement-breakpoint
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_abandoned_no_accuracy" CHECK (("race_results"."status" = 'abandoned') = ("race_results"."accuracy" is null));