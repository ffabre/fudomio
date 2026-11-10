CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `floor_items` (
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
	`created_at` integer NOT NULL,
	FOREIGN KEY (`floor_id`) REFERENCES `floors`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "floor_items_kind" CHECK("floor_items"."kind" in ('table', 'block', 'outline')),
	CONSTRAINT "floor_items_shape" CHECK("floor_items"."shape" in ('circle', 'square', 'rectangle', 'polygon')),
	CONSTRAINT "floor_items_points" CHECK(("floor_items"."shape" = 'polygon' and "floor_items"."points" is not null) or ("floor_items"."shape" <> 'polygon' and "floor_items"."points" is null)),
	CONSTRAINT "floor_items_polygon_rotation" CHECK("floor_items"."shape" <> 'polygon' or "floor_items"."rotation" = 0),
	CONSTRAINT "floor_items_seats" CHECK("floor_items"."seats" is null or ("floor_items"."kind" = 'table' and "floor_items"."seats" >= 1))
);
--> statement-breakpoint
CREATE TABLE `floors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`width` integer DEFAULT 1600 NOT NULL,
	`height` integer DEFAULT 1000 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`quantity` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "order_items_unit_price_cents_non_negative" CHECK("order_items"."unit_price_cents" >= 0),
	CONSTRAINT "order_items_quantity_positive" CHECK("order_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`floor_item_id` integer NOT NULL,
	`status` text NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`floor_item_id`) REFERENCES `floor_items`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "orders_status" CHECK("orders"."status" in ('open', 'closed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_one_open_per_floor_item` ON `orders` (`floor_item_id`) WHERE "orders"."status" = 'open';--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subcategory_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_cents` integer NOT NULL,
	`is_available` integer DEFAULT 1 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "products_price_cents_non_negative" CHECK("products"."price_cents" >= 0),
	CONSTRAINT "products_is_available_bool" CHECK("products"."is_available" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `subcategories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
