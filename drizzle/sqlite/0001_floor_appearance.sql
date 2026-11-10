PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_floor_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`floor_id` integer NOT NULL,
	`kind` text NOT NULL,
	`shape` text NOT NULL,
	`label` text,
	`seats` integer,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`width` real NOT NULL,
	`height` real NOT NULL,
	`rotation` real DEFAULT 0 NOT NULL,
	`points` text,
	`z_index` integer DEFAULT 0 NOT NULL,
	`color` text,
	`fixture` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`floor_id`) REFERENCES `floors`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "floor_items_kind" CHECK("__new_floor_items"."kind" in ('table', 'block', 'outline')),
	CONSTRAINT "floor_items_shape" CHECK("__new_floor_items"."shape" in ('circle', 'square', 'rectangle', 'polygon')),
	CONSTRAINT "floor_items_points" CHECK(("__new_floor_items"."shape" = 'polygon' and "__new_floor_items"."points" is not null) or ("__new_floor_items"."shape" <> 'polygon' and "__new_floor_items"."points" is null)),
	CONSTRAINT "floor_items_polygon_rotation" CHECK("__new_floor_items"."shape" <> 'polygon' or "__new_floor_items"."rotation" = 0),
	CONSTRAINT "floor_items_seats" CHECK("__new_floor_items"."seats" is null or ("__new_floor_items"."kind" = 'table' and "__new_floor_items"."seats" >= 1)),
	CONSTRAINT "floor_items_color" CHECK("__new_floor_items"."color" is null or "__new_floor_items"."color" in ('sand', 'linen', 'clay', 'sage', 'sea', 'stone', 'wood', 'ink')),
	CONSTRAINT "floor_items_fixture" CHECK("__new_floor_items"."fixture" is null or ("__new_floor_items"."kind" = 'block' and "__new_floor_items"."fixture" in ('column', 'door', 'window')))
);
--> statement-breakpoint
INSERT INTO `__new_floor_items`("id", "floor_id", "kind", "shape", "label", "seats", "x", "y", "width", "height", "rotation", "points", "z_index", "created_at") SELECT "id", "floor_id", "kind", "shape", "label", "seats", "x", "y", "width", "height", "rotation", "points", "z_index", "created_at" FROM `floor_items`;--> statement-breakpoint
DROP TABLE `floor_items`;--> statement-breakpoint
ALTER TABLE `__new_floor_items` RENAME TO `floor_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;