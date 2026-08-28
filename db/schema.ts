import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  userId: text("user_id"),
});

export const postMedia = sqliteTable("post_media", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  position: integer("position").notNull().default(0),
  caption: text("caption").notNull().default(""),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  mediaType: text("media_type").notNull().default("image"),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("post_media_post_position_uidx").on(table.postId, table.position)]);

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
  userId: text("user_id"),
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
  caption: text("caption").notNull().default(""),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  mediaType: text("media_type").notNull().default("image"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  userId: text("user_id"),
  captionX: integer("caption_x").notNull().default(50),
  captionY: integer("caption_y").notNull().default(86),
});

export const storyViews = sqliteTable("story_views", {
  storyId: text("story_id").notNull(),
  userId: text("user_id").notNull(),
  viewedAt: integer("viewed_at").notNull(),
}, (table) => [primaryKey({ columns: [table.storyId, table.userId] })]);

export const storyReactions = sqliteTable("story_reactions", {
  storyId: text("story_id").notNull(),
  userId: text("user_id").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.storyId, table.userId] }),
  index("story_reactions_story_idx").on(table.storyId, table.createdAt),
]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  website: text("website").notNull().default(""),
  location: text("location").notNull().default(""),
  showLocation: integer("show_location", { mode: "boolean" }).notNull().default(true),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  heroImageKey: text("hero_image_key"),
  heroImageUrl: text("hero_image_url"),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("active"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  storyReplies: integer("story_replies", { mode: "boolean" }).notNull().default(true),
  highQualityUploads: integer("high_quality_uploads", { mode: "boolean" }).notNull().default(true),
  savedCollectionPublic: integer("saved_collection_public", { mode: "boolean" }).notNull().default(false),
  adultConfirmedAt: integer("adult_confirmed_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const invites = sqliteTable("invites", {
  code: text("code").primaryKey(),
  createdBy: text("created_by").notNull(),
  claimedBy: text("claimed_by"),
  createdAt: integer("created_at").notNull(),
  claimedAt: integer("claimed_at"),
  // Retained for migration compatibility with the original invite reservation flow.
  // New registrations are reserved in pending_registrations instead.
  reservedEmail: text("reserved_email"),
  reservedAt: integer("reserved_at"),
  revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
});

export const pendingRegistrations = sqliteTable("pending_registrations", {
  authUserId: text("auth_user_id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  inviteCode: text("invite_code").unique(),
  adultConfirmedAt: integer("adult_confirmed_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const follows = sqliteTable("follows", {
  followerId: text("follower_id").notNull(),
  followedId: text("followed_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const followRequests = sqliteTable("follow_requests", {
  requesterId: text("requester_id").notNull(),
  targetId: text("target_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at").notNull(),
  respondedAt: integer("responded_at"),
}, (table) => [
  primaryKey({ columns: [table.requesterId, table.targetId] }),
  index("follow_requests_target_status_idx").on(table.targetId, table.status, table.createdAt),
]);

export const blocks = sqliteTable("blocks", {
  blockerId: text("blocker_id").notNull(),
  blockedId: text("blocked_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  actorId: text("actor_id"),
  type: text("type").notNull(),
  entityId: text("entity_id"),
  message: text("message").notNull(),
  readAt: integer("read_at"),
  createdAt: integer("created_at").notNull(),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userA: text("user_a").notNull(),
  userB: text("user_b").notNull(),
  requestedBy: text("requested_by").notNull(),
  status: text("status").notNull().default("accepted"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  senderId: text("sender_id").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
  readAt: integer("read_at"),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: integer("created_at").notNull(),
});

export const postLikes = sqliteTable("post_likes", {
  postId: text("post_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const postSaves = sqliteTable("post_saves", {
  postId: text("post_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at").notNull(),
});
