ALTER TABLE "room_members" ADD COLUMN "name" text;--> statement-breakpoint
UPDATE "room_members" SET "name" = "users"."display_name" FROM "users" WHERE "users"."id" = "room_members"."user_id";--> statement-breakpoint
ALTER TABLE "room_members" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "room_members_room_name_idx" ON "room_members" USING btree ("room_id",lower("name"));--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_name_length" CHECK (char_length("room_members"."name") between 3 and 20);
