CREATE TABLE "user_avatars" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"image" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_avatars_size" CHECK (octet_length("user_avatars"."image") <= 512 * 1024)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stem_color" text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "petal_color" text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;