CREATE TABLE `pending_registrations` (
	`auth_user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`invite_code` text,
	`adult_confirmed_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_registrations_email_unique` ON `pending_registrations` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `pending_registrations_username_unique` ON `pending_registrations` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `pending_registrations_invite_code_unique` ON `pending_registrations` (`invite_code`);
