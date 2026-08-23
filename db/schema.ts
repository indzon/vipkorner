import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

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
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  privateAccount: integer("private_account", { mode: "boolean" }).notNull().default(true),
  storyReplies: integer("story_replies", { mode: "boolean" }).notNull().default(true),
  highQualityUploads: integer("high_quality_uploads", { mode: "boolean" }).notNull().default(true),
});

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  postId: text("post_id"),
  message: text("message").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
