CREATE INDEX "race_results_guest_idx" ON "race_results" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "rooms_host_idx" ON "rooms" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "rooms_closed_at_idx" ON "rooms" USING btree ("closed_at");--> statement-breakpoint
CREATE INDEX "users_guest_created_idx" ON "users" USING btree ("created_at") WHERE "users"."is_guest";