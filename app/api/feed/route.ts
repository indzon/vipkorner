import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { authErrorResponse, requireUser } from "@/lib/current-user";

export async function GET() {
  try {
    await ensureSchema();
    const viewer = await requireUser();
    const { DB } = bindings();
    const now = Date.now();
    await DB.prepare("DELETE FROM stories WHERE expires_at <= ?").bind(now).run();
    await DB.prepare("DELETE FROM story_views WHERE story_id NOT IN (SELECT id FROM stories)").run();
    await DB.prepare("DELETE FROM story_reactions WHERE story_id NOT IN (SELECT id FROM stories)").run();

    const [posts, postMedia, stories, comments, notifications, following, followers] = await Promise.all([
      DB.prepare(`SELECT p.id, p.caption, p.image_key AS imageKey, p.image_url AS imageUrl,
        p.media_type AS mediaType, p.created_at AS createdAt, p.user_id AS userId,
        p.likes + (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
        EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked,
        EXISTS(SELECT 1 FROM post_saves s WHERE s.post_id = p.id AND s.user_id = ?) AS saved,
        u.username, u.display_name AS displayName, u.location, u.image_key AS authorImageKey, u.image_url AS authorImageUrl
        FROM posts p JOIN users u ON u.id = p.user_id
        WHERE u.status = 'active' AND (u.is_public = 1 OR p.user_id = ? OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followed_id = p.user_id)) AND NOT EXISTS (
          SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = p.user_id)
          OR (b.blocker_id = p.user_id AND b.blocked_id = ?)
        ) ORDER BY p.created_at DESC LIMIT 100`).bind(viewer.id, viewer.id, viewer.id, viewer.id, viewer.id, viewer.id).all(),
      DB.prepare(`SELECT m.id, m.post_id AS postId, m.position, m.caption,
        m.image_key AS imageKey, m.image_url AS imageUrl, m.media_type AS mediaType
        FROM post_media m JOIN posts p ON p.id = m.post_id JOIN users u ON u.id = p.user_id
        WHERE u.status = 'active' AND (u.is_public = 1 OR p.user_id = ? OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followed_id = p.user_id)) AND NOT EXISTS (
          SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = p.user_id)
          OR (b.blocker_id = p.user_id AND b.blocked_id = ?)
        ) ORDER BY m.post_id, m.position`).bind(viewer.id, viewer.id, viewer.id, viewer.id).all(),
      DB.prepare(`SELECT s.id, s.caption, s.image_key AS imageKey, s.image_url AS imageUrl,
        s.media_type AS mediaType, s.created_at AS createdAt, s.expires_at AS expiresAt,
        s.caption_x AS captionX, s.caption_y AS captionY, s.user_id AS userId,
        EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.user_id = ?) AS viewed,
        (SELECT r.emoji FROM story_reactions r WHERE r.story_id = s.id AND r.user_id = ?) AS reaction,
        (SELECT COUNT(*) FROM story_reactions r WHERE r.story_id = s.id) AS reactionCount,
        u.story_replies AS reactionsAllowed, u.username, u.display_name AS displayName,
        u.image_key AS authorImageKey, u.image_url AS authorImageUrl
        FROM stories s JOIN users u ON u.id = s.user_id
        WHERE s.expires_at > ? AND u.status = 'active' AND (u.is_public = 1 OR s.user_id = ? OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followed_id = s.user_id)) AND NOT EXISTS (
          SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = s.user_id)
          OR (b.blocker_id = s.user_id AND b.blocked_id = ?)
        ) ORDER BY s.created_at ASC`).bind(viewer.id, viewer.id, now, viewer.id, viewer.id, viewer.id, viewer.id).all(),
      DB.prepare(`SELECT c.id, c.post_id AS postId, c.body, c.created_at AS createdAt, c.user_id AS userId,
        u.username, u.display_name AS displayName, u.image_key AS authorImageKey, u.image_url AS authorImageUrl
        FROM comments c JOIN users u ON u.id = c.user_id
        WHERE u.status = 'active' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = c.user_id) OR (b.blocker_id = c.user_id AND b.blocked_id = ?))
        ORDER BY c.created_at ASC`).bind(viewer.id, viewer.id).all(),
      DB.prepare(`SELECT n.id, n.type, n.entity_id AS postId, n.message, n.created_at AS createdAt,
        n.read_at AS readAt, n.actor_id AS actorId, u.username AS actorUsername,
        u.display_name AS actorDisplayName, u.image_key AS actorImageKey, u.image_url AS actorImageUrl
        FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
        WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 50`).bind(viewer.id).all(),
      DB.prepare("SELECT COUNT(*) AS total FROM follows WHERE follower_id = ?").bind(viewer.id).first<{ total: number }>(),
      DB.prepare("SELECT COUNT(*) AS total FROM follows WHERE followed_id = ?").bind(viewer.id).first<{ total: number }>(),
    ]);

    const commentsByPost = comments.results.reduce<Record<string, unknown[]>>((grouped, comment) => {
      const postId = String(comment.postId);
      (grouped[postId] ||= []).push({
        ...comment,
        author: { id: comment.userId, username: comment.username, displayName: comment.displayName, imageKey: comment.authorImageKey, imageUrl: comment.authorImageUrl },
      });
      return grouped;
    }, {});
    const mediaByPost = postMedia.results.reduce<Record<string, unknown[]>>((grouped, media) => {
      const postId = String(media.postId);
      (grouped[postId] ||= []).push(media);
      return grouped;
    }, {});
    const postsWithComments = posts.results.map((post) => ({
      ...post,
      media: mediaByPost[String(post.id)] || [],
      author: { id: post.userId, username: post.username, displayName: post.displayName, location: post.location, imageKey: post.authorImageKey, imageUrl: post.authorImageUrl },
      comments: commentsByPost[String(post.id)] || [],
      owned: post.userId === viewer.id,
    }));
    const storyResults = stories.results.map((story) => ({
      ...story,
      author: { id: story.userId, username: story.username, displayName: story.displayName, imageKey: story.authorImageKey, imageUrl: story.authorImageUrl },
      owned: story.userId === viewer.id,
    }));
    const profile = { ...viewer, privateAccount: !Boolean(viewer.isPublic), following: following?.total || 0, followers: followers?.total || 0 };
    return NextResponse.json({ posts: postsWithComments, stories: storyResults, profile, activities: notifications.results });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Could not load the feed." }, { status: 500 });
  }
}
