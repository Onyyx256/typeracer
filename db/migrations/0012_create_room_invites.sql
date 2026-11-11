CREATE TABLE "room_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"token" text NOT NULL,
	"used_by" uuid,
	"used_ip" text,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_invites_token_format" CHECK ("room_invites"."token" ~ '^[A-Za-z0-9_-]{43}$'),
	CONSTRAINT "room_invites_used_together" CHECK (("room_invites"."used_at" is null) = ("room_invites"."used_ip" is null))
);
--> statement-breakpoint
ALTER TABLE "room_invites" ADD CONSTRAINT "room_invites_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_invites" ADD CONSTRAINT "room_invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_invites_token_idx" ON "room_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "room_invites_room_idx" ON "room_invites" USING btree ("room_id","created_at");