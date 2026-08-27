import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { authErrorResponse, blockedBetween, requireUser } from "@/lib/current-user";
import { inspectMediaUpload } from "@/lib/media-upload";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const user = await requireUser();
    const form = await request.formData();
    const media = form.get("image");
    const caption = String(form.get("caption") ?? "").trim().slice(0, 500);
    const upload = media instanceof File ? await inspectMediaUpload(media) : null;
    if (!(media instanceof File) || !upload) return NextResponse.json({ error: "Choose a photo or video to share." }, { status: 400 });
    if ((upload.kind === "image" && media.size > MAX_IMAGE_SIZE) || (upload.kind === "video" && media.size > MAX_VIDEO_SIZE)) return NextResponse.json({ error: upload.kind === "video" ? "Videos must be under 50 MB." : "Images must be under 10 MB." }, { status: 400 });
    const { DB, MEDIA } = bindings();
    const id = crypto.randomUUID();
    const key = `${id}.${upload.extension}`;
    const createdAt = Date.now();
    await MEDIA.put(key, media.stream(), { httpMetadata: { contentType: upload.contentType } });
    await DB.prepare("INSERT INTO posts (id, user_id, caption, image_key, media_type, likes, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)")
      .bind(id, user.id, caption || "A new moment.", key, upload.kind, createdAt).run();
    return NextResponse.json({ id, userId: user.id, caption: caption || "A new moment.", imageKey: key, imageUrl: null, mediaType: upload.kind, likes: 0, liked: 0, saved: 0, createdAt, owned: true }, { status: 201 });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not create this post." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const user = await requireUser();
    const { id, action, caption } = await request.json() as { id?: string; action?: "like" | "save" | "caption"; caption?: string };
    if (!id || !["like", "save", "caption"].includes(action || "")) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    const { DB } = bindings();
    const post = await DB.prepare("SELECT user_id AS userId, caption FROM posts WHERE id = ?").bind(id).first<{ userId: string; caption: string }>();
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if (await blockedBetween(user.id, post.userId)) return NextResponse.json({ error: "This interaction is unavailable." }, { status: 403 });

    if (action === "caption") {
      if (post.userId !== user.id) return NextResponse.json({ error: "Only the original poster can edit this caption." }, { status: 403 });
      const nextCaption = String(caption || "").trim().slice(0, 500);
      if (!nextCaption) return NextResponse.json({ error: "Caption cannot be empty." }, { status: 400 });
      await DB.prepare("UPDATE posts SET caption = ? WHERE id = ?").bind(nextCaption, id).run();
    } else {
      const table = action === "like" ? "post_likes" : "post_saves";
      const current = await DB.prepare(`SELECT 1 AS active FROM ${table} WHERE post_id = ? AND user_id = ?`).bind(id, user.id).first();
      if (current) await DB.prepare(`DELETE FROM ${table} WHERE post_id = ? AND user_id = ?`).bind(id, user.id).run();
      else await DB.prepare(`INSERT INTO ${table} (post_id, user_id, created_at) VALUES (?, ?, ?)`).bind(id, user.id, Date.now()).run();
      if (action === "like" && !current && post.userId !== user.id) {
        await DB.prepare("INSERT INTO notifications (id, user_id, actor_id, type, entity_id, message, created_at) VALUES (?, ?, ?, 'like', ?, ?, ?)")
          .bind(crypto.randomUUID(), post.userId, user.id, id, `@${user.username} liked your post.`, Date.now()).run();
      }
    }
    const result = await DB.prepare(`SELECT caption,
      likes + (SELECT COUNT(*) FROM post_likes WHERE post_id = ?) AS likes,
      EXISTS(SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?) AS liked,
      EXISTS(SELECT 1 FROM post_saves WHERE post_id = ? AND user_id = ?) AS saved
      FROM posts WHERE id = ?`).bind(id, id, user.id, id, user.id, id).first();
    return NextResponse.json(result);
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not update this post." }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const user = await requireUser();
    const form = await request.formData();
    const id = String(form.get("id") || "");
    const media = form.get("image");
    const upload = media instanceof File ? await inspectMediaUpload(media) : null;
    if (!id || !(media instanceof File) || !upload) return NextResponse.json({ error: "Choose a photo or video." }, { status: 400 });
    const { DB, MEDIA } = bindings();
    const current = await DB.prepare("SELECT user_id AS userId, image_key AS imageKey FROM posts WHERE id = ?").bind(id).first<{ userId: string; imageKey: string | null }>();
    if (!current || current.userId !== user.id) return NextResponse.json({ error: "Only the original poster can edit this post." }, { status: 403 });
    const key = `${id}-${crypto.randomUUID()}.${upload.extension}`;
    await MEDIA.put(key, media.stream(), { httpMetadata: { contentType: upload.contentType } });
    await DB.prepare("UPDATE posts SET image_key = ?, image_url = NULL, media_type = ? WHERE id = ?").bind(key, upload.kind, id).run();
    if (current.imageKey) await MEDIA.delete(current.imageKey);
    return NextResponse.json({ id, imageKey: key, imageUrl: null, mediaType: upload.kind });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not update this post." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Post id is required." }, { status: 400 });
    const { DB, MEDIA } = bindings();
    const post = await DB.prepare("SELECT user_id AS userId, image_key AS imageKey FROM posts WHERE id = ?").bind(id).first<{ userId: string; imageKey: string | null }>();
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if (post.userId !== user.id) return NextResponse.json({ error: "Only the original poster can delete this post." }, { status: 403 });
    const media = await DB.prepare("SELECT image_key AS imageKey FROM post_media WHERE post_id = ?").bind(id).all<{ imageKey: string | null }>();
    await DB.batch([
      DB.prepare("DELETE FROM comments WHERE post_id = ?").bind(id),
      DB.prepare("DELETE FROM post_likes WHERE post_id = ?").bind(id),
      DB.prepare("DELETE FROM post_saves WHERE post_id = ?").bind(id),
      DB.prepare("DELETE FROM post_media WHERE post_id = ?").bind(id),
      DB.prepare("DELETE FROM posts WHERE id = ?").bind(id),
    ]);
    const keys = Array.from(new Set([post.imageKey, ...media.results.map((item) => item.imageKey)].filter((key): key is string => Boolean(key))));
    await Promise.all(keys.map((key) => MEDIA.delete(key)));
    return NextResponse.json({ deleted: true });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not delete this post." }, { status: 500 }); }
}
