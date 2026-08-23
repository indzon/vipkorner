import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  await ensureSchema();
  const form = await request.formData();
  const image = form.get("image");
  const caption = String(form.get("caption") ?? "").trim();

  const isImage = image instanceof File && image.type.startsWith("image/");
  const isVideo = image instanceof File && image.type.startsWith("video/");
  if (!(image instanceof File) || (!isImage && !isVideo)) {
    return NextResponse.json({ error: "Choose a photo or video to share." }, { status: 400 });
  }
  if ((isImage && image.size > MAX_IMAGE_SIZE) || (isVideo && image.size > MAX_VIDEO_SIZE)) {
    return NextResponse.json({ error: isVideo ? "Videos must be under 50 MB." : "Images must be under 10 MB." }, { status: 400 });
  }

  const { DB, MEDIA } = bindings();
  const id = crypto.randomUUID();
  const key = `${id}.${image.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg"}`;
  const createdAt = Date.now();
  await MEDIA.put(key, image.stream(), { httpMetadata: { contentType: image.type } });
  const mediaType = isVideo ? "video" : "image";
  await DB.prepare("INSERT INTO posts (id, caption, image_key, media_type, likes, created_at) VALUES (?, ?, ?, ?, 0, ?)")
    .bind(id, caption || "A new moment.", key, mediaType, createdAt)
    .run();

  return NextResponse.json({ id, caption: caption || "A new moment.", imageKey: key, imageUrl: null, mediaType, likes: 0, liked: 0, saved: 0, createdAt }, { status: 201 });
}

export async function PATCH(request: Request) {
  await ensureSchema();
  const { id, action, caption } = await request.json() as { id?: string; action?: "like" | "save" | "caption"; caption?: string };
  if (!id || !["like", "save", "caption"].includes(action ?? "")) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { DB } = bindings();
  if (action === "like") {
    await DB.prepare("UPDATE posts SET likes = MAX(0, likes + CASE WHEN liked = 1 THEN -1 ELSE 1 END), liked = CASE liked WHEN 1 THEN 0 ELSE 1 END WHERE id = ?").bind(id).run();
    const likedPost = await DB.prepare("SELECT liked, caption FROM posts WHERE id = ?").bind(id).first<{ liked: number; caption: string }>();
    if (likedPost?.liked) {
      await DB.prepare("INSERT INTO activities (id, type, post_id, message, created_at) VALUES (?, 'like', ?, ?, ?)")
        .bind(crypto.randomUUID(), id, `You liked “${likedPost.caption.slice(0, 72)}”`, Date.now()).run();
    }
  } else {
    if (action === "save") {
      await DB.prepare("UPDATE posts SET saved = CASE saved WHEN 1 THEN 0 ELSE 1 END WHERE id = ?").bind(id).run();
    } else {
      const nextCaption = String(caption ?? "").trim().slice(0, 500);
      if (!nextCaption) return NextResponse.json({ error: "Caption cannot be empty." }, { status: 400 });
      await DB.prepare("UPDATE posts SET caption = ? WHERE id = ?").bind(nextCaption, id).run();
    }
  }
  const post = await DB.prepare("SELECT caption, likes, liked, saved FROM posts WHERE id = ?").bind(id).first();
  return NextResponse.json(post);
}
