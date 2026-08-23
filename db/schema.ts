import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  caption: text("caption").notNull(),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  likes: integer("likes").notNull().default(0),
  liked: integer("liked", { mode: "boolean" }).notNull().default(false),
  saved: integer("saved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
