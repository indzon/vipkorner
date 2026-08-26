CREATE TABLE `story_reactions` (
	`story_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`story_id`, `user_id`)
);
