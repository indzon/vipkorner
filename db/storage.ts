import { env } from "cloudflare:workers";

type AppEnv = {
  DB: D1Database;
  MEDIA: R2Bucket;
};

export function bindings() {
  return env as unknown as AppEnv;
}

export async function ensureSchema() {
  const { DB } = bindings();
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      caption TEXT NOT NULL,
      image_key TEXT,
      image_url TEXT,
      media_type TEXT NOT NULL DEFAULT 'image',
      likes INTEGER NOT NULL DEFAULT 0,
      liked INTEGER NOT NULL DEFAULT 0,
      saved INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      caption TEXT NOT NULL DEFAULT '',
      image_key TEXT,
      image_url TEXT,
      media_type TEXT NOT NULL DEFAULT 'image',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    DB.prepare("CREATE INDEX IF NOT EXISTS posts_created_idx ON posts (created_at DESC)"),
    DB.prepare("CREATE INDEX IF NOT EXISTS stories_expires_idx ON stories (expires_at)"),
    DB.prepare(`CREATE TABLE IF NOT EXISTS profile (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      bio TEXT NOT NULL,
      website TEXT NOT NULL,
      location TEXT NOT NULL,
      image_key TEXT,
      image_url TEXT,
      private_account INTEGER NOT NULL DEFAULT 1,
      story_replies INTEGER NOT NULL DEFAULT 1,
      high_quality_uploads INTEGER NOT NULL DEFAULT 1
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      post_id TEXT,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`),
    DB.prepare("CREATE INDEX IF NOT EXISTS comments_post_idx ON comments (post_id, created_at)"),
    DB.prepare("CREATE INDEX IF NOT EXISTS activities_created_idx ON activities (created_at DESC)"),
    DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '', image_key TEXT, image_url TEXT,
      role TEXT NOT NULL DEFAULT 'user', status TEXT NOT NULL DEFAULT 'active', is_public INTEGER NOT NULL DEFAULT 1,
      story_replies INTEGER NOT NULL DEFAULT 1, high_quality_uploads INTEGER NOT NULL DEFAULT 1,
      adult_confirmed_at INTEGER NOT NULL, created_at INTEGER NOT NULL
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY, created_by TEXT NOT NULL, claimed_by TEXT, created_at INTEGER NOT NULL,
      claimed_at INTEGER, revoked INTEGER NOT NULL DEFAULT 0
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL, followed_id TEXT NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY (follower_id, followed_id)
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS blocks (
      blocker_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY (blocker_id, blocked_id)
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, actor_id TEXT, type TEXT NOT NULL,
      entity_id TEXT, message TEXT NOT NULL, read_at INTEGER, created_at INTEGER NOT NULL
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, user_a TEXT NOT NULL, user_b TEXT NOT NULL, requested_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'accepted', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      UNIQUE (user_a, user_b)
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_id TEXT NOT NULL,
      body TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
      reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS post_likes (
      post_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY (post_id, user_id)
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS post_saves (
      post_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY (post_id, user_id)
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS story_views (
      story_id TEXT NOT NULL, user_id TEXT NOT NULL, viewed_at INTEGER NOT NULL,
      PRIMARY KEY (story_id, user_id)
    )`),
    DB.prepare("CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC)"),
    DB.prepare("CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at)"),
    DB.prepare("CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC)"),
  ]);

  const postColumns = await DB.prepare("PRAGMA table_info(posts)").all<{ name: string }>();
  if (!postColumns.results.some((column) => column.name === "media_type")) {
    await DB.prepare("ALTER TABLE posts ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image'").run();
  }
  if (!postColumns.results.some((column) => column.name === "user_id")) {
    await DB.prepare("ALTER TABLE posts ADD COLUMN user_id TEXT").run();
  }

  const storyColumns = await DB.prepare("PRAGMA table_info(stories)").all<{ name: string }>();
  if (!storyColumns.results.some((column) => column.name === "caption")) {
    await DB.prepare("ALTER TABLE stories ADD COLUMN caption TEXT NOT NULL DEFAULT ''").run();
  }
  if (!storyColumns.results.some((column) => column.name === "media_type")) {
    await DB.prepare("ALTER TABLE stories ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image'").run();
  }
  if (!storyColumns.results.some((column) => column.name === "user_id")) {
    await DB.prepare("ALTER TABLE stories ADD COLUMN user_id TEXT").run();
  }
  if (!storyColumns.results.some((column) => column.name === "caption_x")) {
    await DB.prepare("ALTER TABLE stories ADD COLUMN caption_x INTEGER NOT NULL DEFAULT 50").run();
  }
  if (!storyColumns.results.some((column) => column.name === "caption_y")) {
    await DB.prepare("ALTER TABLE stories ADD COLUMN caption_y INTEGER NOT NULL DEFAULT 86").run();
  }

  const commentColumns = await DB.prepare("PRAGMA table_info(comments)").all<{ name: string }>();
  if (!commentColumns.results.some((column) => column.name === "user_id")) {
    await DB.prepare("ALTER TABLE comments ADD COLUMN user_id TEXT").run();
  }

  const profileColumns = await DB.prepare("PRAGMA table_info(profile)").all<{ name: string }>();
  if (!profileColumns.results.some((column) => column.name === "image_key")) {
    await DB.prepare("ALTER TABLE profile ADD COLUMN image_key TEXT").run();
  }
  if (!profileColumns.results.some((column) => column.name === "image_url")) {
    await DB.prepare("ALTER TABLE profile ADD COLUMN image_url TEXT").run();
  }

  await DB.prepare(`INSERT OR IGNORE INTO profile (
    id, username, display_name, bio, website, location, private_account, story_replies, high_quality_uploads
  ) VALUES ('me', 'emma.wright', 'Emma Wright', 'Little moments, city light, and everything in between. ✨', 'emmawrites.co', 'New York, NY', 1, 1, 1)`).run();
  await DB.prepare("INSERT OR IGNORE INTO app_meta (key, value) VALUES ('registration_mode', 'invite')").run();
  await DB.prepare(`INSERT OR IGNORE INTO activities (id, type, post_id, message, created_at)
    SELECT 'like-' || id, 'like', id, 'You liked “' || substr(caption, 1, 72) || '”', CAST(strftime('%s', 'now') AS INTEGER) * 1000
    FROM posts
    WHERE liked = 1 AND NOT EXISTS (
      SELECT 1 FROM activities existing WHERE existing.type = 'like' AND existing.post_id = posts.id
    )`).run();
}

export async function seedDemoContent() {
  const { DB } = bindings();
  const now = Date.now();
  await DB.prepare("DELETE FROM stories WHERE expires_at <= ?").bind(now).run();
  const seeded = await DB.prepare("SELECT value FROM app_meta WHERE key = 'content_seeded'").first();
  if (seeded) return;

  const count = await DB.prepare("SELECT COUNT(*) AS total FROM posts").first<{ total: number }>();

  if (!count?.total) {
    await DB.batch([
      DB.prepare("INSERT INTO posts (id, caption, image_url, media_type, likes, created_at) VALUES (?, ?, ?, 'image', ?, ?)")
        .bind("hello-august", "Slow Sundays, good light, and nowhere else to be. ☕", "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=88", 128, now - 42 * 60 * 1000),
      DB.prepare("INSERT INTO posts (id, caption, image_url, media_type, likes, created_at) VALUES (?, ?, ?, 'image', ?, ?)")
        .bind("coastline", "A little salt air reset from last weekend.", "https://images.unsplash.com/photo-1500534314209-a25ddb2bd4297?auto=format&fit=crop&w=1400&q=88", 246, now - 22 * 60 * 60 * 1000),
      DB.prepare("INSERT INTO posts (id, caption, image_url, media_type, likes, created_at) VALUES (?, ?, ?, 'image', ?, ?)")
        .bind("market-day", "Market morning colors. Saving this one for the mood board.", "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=1400&q=88", 94, now - 2 * 24 * 60 * 60 * 1000),
    ]);
  }

  const activeStories = await DB.prepare("SELECT COUNT(*) AS total FROM stories").first<{ total: number }>();
  if (!activeStories?.total) {
    await DB.batch([
      DB.prepare("INSERT INTO stories (id, image_url, created_at, expires_at) VALUES (?, ?, ?, ?)")
        .bind(`coffee-${now}`, "https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=1000&q=88", now - 38 * 60 * 1000, now + 23 * 60 * 60 * 1000),
      DB.prepare("INSERT INTO stories (id, image_url, created_at, expires_at) VALUES (?, ?, ?, ?)")
        .bind(`city-${now}`, "https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?auto=format&fit=crop&w=1000&q=88", now - 3 * 60 * 60 * 1000, now + 21 * 60 * 60 * 1000),
    ]);
  }
  await DB.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('content_seeded', ?)").bind(String(now)).run();
}
