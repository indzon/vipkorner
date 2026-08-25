CREATE TABLE `story_views` (
	`story_id` text NOT NULL,
	`user_id` text NOT NULL,
	`viewed_at` integer NOT NULL,
	PRIMARY KEY(`story_id`, `user_id`)
);
