import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  caption: text("caption").notNull(),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  mediaType: text("media_type").notNull().default("image"),
  likes: integer("likes").notNull().default(0),
  liked: integer("liked", { mode: "boolean" }).notNull().default(false),
  saved: integer("saved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const profile = sqliteTable("profile", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull(),
  website: text("website").notNull(),
  location: text("location").notNull(),
  privateAccount: integer("private_account", { mode: "boolean" }).notNull().default(true),
  storyReplies: integer("story_replies", { mode: "boolean" }).notNull().default(true),
  highQualityUploads: integer("high_quality_uploads", { mode: "boolean" }).notNull().default(true),
});

export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
