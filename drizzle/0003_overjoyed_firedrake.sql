CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `stories` ADD `caption` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stories` ADD `media_type` text DEFAULT 'image' NOT NULL;