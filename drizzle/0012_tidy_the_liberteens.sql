CREATE TABLE `follow_requests` (
	`requester_id` text NOT NULL,
	`target_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`responded_at` integer,
	PRIMARY KEY(`requester_id`, `target_id`)
);
--> statement-breakpoint
CREATE INDEX `follow_requests_target_status_idx` ON `follow_requests` (`target_id`,`status`,`created_at`);