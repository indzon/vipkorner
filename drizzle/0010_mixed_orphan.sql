CREATE TABLE `post_media` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`image_key` text,
	`image_url` text,
	`media_type` text DEFAULT 'image' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `post_media_post_idx` ON `post_media` (`post_id`,`position`);