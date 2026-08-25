import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { authErrorResponse, blockedBetween, requireUser } from "@/lib/current-user";

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const user = await requireUser();
    const { postId, body } = await request.json() as { postId?: string; body?: string };
    const comment = String(body || "").trim().slice(0, 280);
    if (!postId || !comment) return NextResponse.json({ error: "Write a comment first." }, { status: 400 });
    const { DB } = bindings();
    const post = await DB.prepare("SELECT user_id AS userId FROM posts WHERE id = ?").bind(postId).first<{ userId: string }>();
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if (await blockedBetween(user.id, post.userId)) return NextResponse.json({ error: "Comments are unavailable for this post." }, { status: 403 });
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    await DB.prepare("INSERT INTO comments (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, postId, user.id, comment, createdAt).run();
    if (post.userId !== user.id) await DB.prepare("INSERT INTO notifications (id, user_id, actor_id, type, entity_id, message, created_at) VALUES (?, ?, ?, 'comment', ?, ?, ?)")
      .bind(crypto.randomUUID(), post.userId, user.id, postId, `@${user.username} commented: “${comment.slice(0, 72)}”`, createdAt).run();
    return NextResponse.json({ id, postId, userId: user.id, body: comment, createdAt, author: user }, { status: 201 });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not add this comment." }, { status: 500 }); }
}
