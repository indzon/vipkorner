import { NextResponse } from "next/server";
import { bindings, ensureSchema, seedDemoContent } from "@/db/storage";

export async function GET() {
  await ensureSchema();
  await seedDemoContent();
  const { DB } = bindings();
  const now = Date.now();

  const [posts, stories, profile, comments, activities] = await Promise.all([
    DB.prepare("SELECT id, caption, image_key AS imageKey, image_url AS imageUrl, media_type AS mediaType, likes, liked, saved, created_at AS createdAt FROM posts ORDER BY created_at DESC").all(),
    DB.prepare("SELECT id, image_key AS imageKey, image_url AS imageUrl, created_at AS createdAt, expires_at AS expiresAt FROM stories WHERE expires_at > ? ORDER BY created_at DESC").bind(now).all(),
    DB.prepare("SELECT username, display_name AS displayName, bio, website, location, image_key AS imageKey, image_url AS imageUrl, private_account AS privateAccount, story_replies AS storyReplies, high_quality_uploads AS highQualityUploads FROM profile WHERE id = 'me'").first(),
    DB.prepare("SELECT id, post_id AS postId, body, created_at AS createdAt FROM comments ORDER BY created_at ASC").all(),
    DB.prepare("SELECT id, type, post_id AS postId, message, created_at AS createdAt FROM activities ORDER BY created_at DESC LIMIT 30").all(),
  ]);

  const commentsByPost = comments.results.reduce<Record<string, unknown[]>>((grouped, comment) => {
    const postId = String(comment.postId);
    (grouped[postId] ||= []).push(comment);
    return grouped;
  }, {});
  const postsWithComments = posts.results.map((post) => ({ ...post, comments: commentsByPost[String(post.id)] || [] }));
  return NextResponse.json({ posts: postsWithComments, stories: stories.results, profile, activities: activities.results });
}
