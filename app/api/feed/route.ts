import { NextResponse } from "next/server";
import { bindings, ensureSchema, seedDemoContent } from "@/db/storage";

export async function GET() {
  await ensureSchema();
  await seedDemoContent();
  const { DB } = bindings();
  const now = Date.now();

  const [posts, stories, profile] = await Promise.all([
    DB.prepare("SELECT id, caption, image_key AS imageKey, image_url AS imageUrl, media_type AS mediaType, likes, liked, saved, created_at AS createdAt FROM posts ORDER BY created_at DESC").all(),
    DB.prepare("SELECT id, image_key AS imageKey, image_url AS imageUrl, created_at AS createdAt, expires_at AS expiresAt FROM stories WHERE expires_at > ? ORDER BY created_at DESC").bind(now).all(),
    DB.prepare("SELECT username, display_name AS displayName, bio, website, location, private_account AS privateAccount, story_replies AS storyReplies, high_quality_uploads AS highQualityUploads FROM profile WHERE id = 'me'").first(),
  ]);

  return NextResponse.json({ posts: posts.results, stories: stories.results, profile });
}
