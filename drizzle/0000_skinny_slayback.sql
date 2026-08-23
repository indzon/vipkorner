CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`caption` text NOT NULL,
	`image_key` text,
	`image_url` text,
	`likes` integer DEFAULT 0 NOT NULL,
	`liked` integer DEFAULT false NOT NULL,
	`saved` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`image_key` text,
	`image_url` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
