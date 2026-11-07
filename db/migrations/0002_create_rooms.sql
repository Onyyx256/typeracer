CREATE TABLE "room_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_members_role" CHECK ("room_members"."role" in ('participant', 'spectator'))
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_id" uuid NOT NULL,
	"visibility" text NOT NULL,
	"capacity" integer NOT NULL,
	"state" text DEFAULT 'waiting' NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "rooms_code_format" CHECK ("rooms"."code" ~ '^[A-HJKMNP-Z2-9]{6}$'),
	CONSTRAINT "rooms_visibility" CHECK ("rooms"."visibility" in ('public', 'code', 'private')),
	CONSTRAINT "rooms_capacity" CHECK ("rooms"."capacity" between 2 and 30),
	CONSTRAINT "rooms_state" CHECK ("rooms"."state" in ('waiting', 'countdown', 'racing', 'results', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_members_user_idx" ON "room_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "room_members_room_idx" ON "room_members" USING btree ("room_id","joined_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_code_idx" ON "rooms" USING btree ("code");--> statement-breakpoint
CREATE INDEX "rooms_visibility_state_idx" ON "rooms" USING btree ("visibility","state");