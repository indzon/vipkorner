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
      likes INTEGER NOT NULL DEFAULT 0,
      liked INTEGER NOT NULL DEFAULT 0,
      saved INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      image_key TEXT,
      image_url TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    DB.prepare("CREATE INDEX IF NOT EXISTS posts_created_idx ON posts (created_at DESC)"),
    DB.prepare("CREATE INDEX IF NOT EXISTS stories_expires_idx ON stories (expires_at)"),
  ]);
}

export async function seedDemoContent() {
  const { DB } = bindings();
  const now = Date.now();
  const count = await DB.prepare("SELECT COUNT(*) AS total FROM posts").first<{ total: number }>();

  if (!count?.total) {
    await DB.batch([
      DB.prepare("INSERT INTO posts (id, caption, image_url, likes, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind("hello-august", "Slow Sundays, good light, and nowhere else to be. ☕", "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=88", 128, now - 42 * 60 * 1000),
      DB.prepare("INSERT INTO posts (id, caption, image_url, likes, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind("coastline", "A little salt air reset from last weekend.", "https://images.unsplash.com/photo-1500534314209-a25ddb2bd4297?auto=format&fit=crop&w=1400&q=88", 246, now - 22 * 60 * 60 * 1000),
      DB.prepare("INSERT INTO posts (id, caption, image_url, likes, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind("market-day", "Market morning colors. Saving this one for the mood board.", "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=1400&q=88", 94, now - 2 * 24 * 60 * 60 * 1000),
    ]);
  }

  await DB.prepare("DELETE FROM stories WHERE expires_at <= ?").bind(now).run();
  const activeStories = await DB.prepare("SELECT COUNT(*) AS total FROM stories").first<{ total: number }>();
  if (!activeStories?.total) {
    await DB.batch([
      DB.prepare("INSERT INTO stories (id, image_url, created_at, expires_at) VALUES (?, ?, ?, ?)")
        .bind(`coffee-${now}`, "https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=1000&q=88", now - 38 * 60 * 1000, now + 23 * 60 * 60 * 1000),
      DB.prepare("INSERT INTO stories (id, image_url, created_at, expires_at) VALUES (?, ?, ?, ?)")
        .bind(`city-${now}`, "https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?auto=format&fit=crop&w=1000&q=88", now - 3 * 60 * 60 * 1000, now + 21 * 60 * 60 * 1000),
    ]);
  }
}
