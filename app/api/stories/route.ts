import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { inspectMediaUpload } from "@/lib/media-upload";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  await ensureSchema();
  const form = await request.formData();
  const media = form.get("image");
  const caption = String(form.get("caption") ?? "").trim().slice(0, 280);
  const upload = media instanceof File ? await inspectMediaUpload(media) : null;
  const isImage = upload?.kind === "image";
  const isVideo = upload?.kind === "video";
  if (!(media instanceof File) || !upload) {
    return NextResponse.json({ error: "Choose a photo or video for your story." }, { status: 400 });
  }
  if ((isImage && media.size > MAX_IMAGE_SIZE) || (isVideo && media.size > MAX_VIDEO_SIZE)) {
    return NextResponse.json({ error: isVideo ? "Videos must be under 50 MB." : "Photos must be under 10 MB." }, { status: 400 });
  }

  const { DB, MEDIA } = bindings();
  const id = crypto.randomUUID();
  const key = `${id}.${upload.extension}`;
  const createdAt = Date.now();
  const expiresAt = createdAt + 24 * 60 * 60 * 1000;
  const mediaType = isVideo ? "video" : "image";
  await MEDIA.put(key, media.stream(), { httpMetadata: { contentType: upload.contentType } });
  await DB.prepare("INSERT INTO stories (id, caption, image_key, media_type, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, caption, key, mediaType, createdAt, expiresAt)
    .run();

  return NextResponse.json({ id, caption, imageKey: key, imageUrl: null, mediaType, createdAt, expiresAt }, { status: 201 });
}

export async function DELETE(request: Request) {
  await ensureSchema();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Story id is required." }, { status: 400 });

  const { DB, MEDIA } = bindings();
  const story = await DB.prepare("SELECT image_key AS imageKey FROM stories WHERE id = ?").bind(id).first<{ imageKey: string | null }>();
  if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });

  await DB.prepare("DELETE FROM stories WHERE id = ?").bind(id).run();
  if (story.imageKey) await MEDIA.delete(story.imageKey);
  return NextResponse.json({ deleted: true });
}
