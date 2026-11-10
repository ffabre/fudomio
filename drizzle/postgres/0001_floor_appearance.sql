ALTER TABLE "floor_items" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "floor_items" ADD COLUMN "fixture" text;--> statement-breakpoint
ALTER TABLE "floor_items" ADD CONSTRAINT "floor_items_color" CHECK ("floor_items"."color" is null or "floor_items"."color" in ('sand', 'linen', 'clay', 'sage', 'sea', 'stone', 'wood', 'ink'));--> statement-breakpoint
ALTER TABLE "floor_items" ADD CONSTRAINT "floor_items_fixture" CHECK ("floor_items"."fixture" is null or ("floor_items"."kind" = 'block' and "floor_items"."fixture" in ('column', 'door', 'window')));