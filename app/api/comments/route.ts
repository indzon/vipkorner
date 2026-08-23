import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";

export async function POST(request: Request) {
  await ensureSchema();
  const { postId, body } = await request.json() as { postId?: string; body?: string };
  const comment = String(body ?? "").trim().slice(0, 280);
  if (!postId || !comment) return NextResponse.json({ error: "Write a comment first." }, { status: 400 });

  const { DB } = bindings();
  const post = await DB.prepare("SELECT caption FROM posts WHERE id = ?").bind(postId).first<{ caption: string }>();
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await DB.batch([
    DB.prepare("INSERT INTO comments (id, post_id, body, created_at) VALUES (?, ?, ?, ?)").bind(id, postId, comment, createdAt),
    DB.prepare("INSERT INTO activities (id, type, post_id, message, created_at) VALUES (?, 'comment', ?, ?, ?)").bind(crypto.randomUUID(), postId, `You commented “${comment.slice(0, 72)}”`, createdAt),
  ]);

  return NextResponse.json({ id, postId, body: comment, createdAt }, { status: 201 });
}
