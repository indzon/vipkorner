import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  await ensureSchema();
  const form = await request.formData();
  const image = form.get("image");
  const caption = String(form.get("caption") ?? "").trim();

  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return NextResponse.json({ error: "Choose an image to share." }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Images must be under 10 MB." }, { status: 400 });
  }

  const { DB, MEDIA } = bindings();
  const id = crypto.randomUUID();
  const key = `${id}.${image.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg"}`;
  const createdAt = Date.now();
  await MEDIA.put(key, image.stream(), { httpMetadata: { contentType: image.type } });
  await DB.prepare("INSERT INTO posts (id, caption, image_key, likes, created_at) VALUES (?, ?, ?, 0, ?)")
    .bind(id, caption || "A new moment.", key, createdAt)
    .run();

  return NextResponse.json({ id, caption: caption || "A new moment.", imageKey: key, imageUrl: null, likes: 0, liked: 0, saved: 0, createdAt }, { status: 201 });
}

export async function PATCH(request: Request) {
  await ensureSchema();
  const { id, action } = await request.json() as { id?: string; action?: "like" | "save" };
  if (!id || !["like", "save"].includes(action ?? "")) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { DB } = bindings();
  if (action === "like") {
    await DB.prepare("UPDATE posts SET likes = MAX(0, likes + CASE WHEN liked = 1 THEN -1 ELSE 1 END), liked = CASE liked WHEN 1 THEN 0 ELSE 1 END WHERE id = ?").bind(id).run();
  } else {
    await DB.prepare("UPDATE posts SET saved = CASE saved WHEN 1 THEN 0 ELSE 1 END WHERE id = ?").bind(id).run();
  }
  const post = await DB.prepare("SELECT likes, liked, saved FROM posts WHERE id = ?").bind(id).first();
  return NextResponse.json(post);
}
