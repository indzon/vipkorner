CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text NOT NULL,
	`website` text NOT NULL,
	`location` text NOT NULL,
	`private_account` integer DEFAULT true NOT NULL,
	`story_replies` integer DEFAULT true NOT NULL,
	`high_quality_uploads` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `media_type` text DEFAULT 'image' NOT NULL;