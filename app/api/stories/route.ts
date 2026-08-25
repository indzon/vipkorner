import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { authErrorResponse, requireUser } from "@/lib/current-user";
import { inspectMediaUpload } from "@/lib/media-upload";

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const user = await requireUser();
    const form = await request.formData();
    const media = form.get("image");
    const caption = String(form.get("caption") || "").trim().slice(0, 280);
    const captionX = Math.max(10, Math.min(90, Number(form.get("captionX") || 50)));
    const captionY = Math.max(12, Math.min(88, Number(form.get("captionY") || 82)));
    const upload = media instanceof File ? await inspectMediaUpload(media) : null;
    if (!(media instanceof File) || !upload) return NextResponse.json({ error: "Choose a photo or video for your story." }, { status: 400 });
    const { DB, MEDIA } = bindings();
    const id = crypto.randomUUID(); const key = `${id}.${upload.extension}`; const createdAt = Date.now(); const expiresAt = createdAt + 86400000;
    await MEDIA.put(key, media.stream(), { httpMetadata: { contentType: upload.contentType } });
    await DB.prepare("INSERT INTO stories (id, user_id, caption, image_key, media_type, created_at, expires_at, caption_x, caption_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, user.id, caption, key, upload.kind, createdAt, expiresAt, captionX, captionY).run();
    return NextResponse.json({ id, userId: user.id, caption, captionX, captionY, imageKey: key, imageUrl: null, mediaType: upload.kind, createdAt, expiresAt, owned: true }, { status: 201 });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not share this story." }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const user = await requireUser();
    const input = await request.json() as { id?: string };
    const id = String(input.id || "");
    if (!id) return NextResponse.json({ error: "Story id is required." }, { status: 400 });
    const { DB } = bindings();
    const story = await DB.prepare(`SELECT s.id FROM stories s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'
      AND (s.user_id = ? OR u.is_public = 1 OR EXISTS(
        SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followed_id = s.user_id
      )) AND NOT EXISTS(
        SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = s.user_id)
        OR (b.blocker_id = s.user_id AND b.blocked_id = ?)
      )`).bind(id, Date.now(), user.id, user.id, user.id, user.id).first<{ id: string }>();
    if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });
    await DB.prepare("INSERT OR REPLACE INTO story_views (story_id, user_id, viewed_at) VALUES (?, ?, ?)")
      .bind(id, user.id, Date.now()).run();
    return NextResponse.json({ viewed: true });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not mark this story as viewed." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema(); const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Story id is required." }, { status: 400 });
    const { DB, MEDIA } = bindings();
    const story = await DB.prepare("SELECT user_id AS userId, image_key AS imageKey FROM stories WHERE id = ?").bind(id).first<{ userId: string; imageKey: string | null }>();
    if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });
    if (story.userId !== user.id) return NextResponse.json({ error: "Only the story owner can delete it." }, { status: 403 });
    await DB.batch([
      DB.prepare("DELETE FROM story_views WHERE story_id = ?").bind(id),
      DB.prepare("DELETE FROM stories WHERE id = ?").bind(id),
    ]);
    if (story.imageKey) await MEDIA.delete(story.imageKey);
    return NextResponse.json({ deleted: true });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not delete this story." }, { status: 500 }); }
}
