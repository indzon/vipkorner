DROP INDEX `post_media_post_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `post_media_post_position_uidx` ON `post_media` (`post_id`,`position`);