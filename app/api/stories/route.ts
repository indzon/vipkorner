import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

function uploadKind(file: File) {
  const videoName = /\.(mp4|webm|mov)$/i.test(file.name);
  const imageName = /\.(jpe?g|png|webp|gif)$/i.test(file.name);
  if (file.type.startsWith("video/") || videoName) return "video" as const;
  if (file.type.startsWith("image/") || imageName) return "image" as const;
  return null;
}

function uploadExtension(file: File) {
  const nameExtension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (nameExtension && ["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov"].includes(nameExtension)) return nameExtension.replace("jpeg", "jpg");
  return (file.type.split("/")[1] || "bin").replace("jpeg", "jpg").replace("quicktime", "mov");
}

function uploadContentType(file: File, kind: "image" | "video") {
  if (kind === "image") return file.type.startsWith("image/") ? file.type : "image/jpeg";
  if (file.type.startsWith("video/")) return file.type;
  const extension = uploadExtension(file);
  return extension === "webm" ? "video/webm" : extension === "mov" ? "video/quicktime" : "video/mp4";
}

export async function POST(request: Request) {
  await ensureSchema();
  const form = await request.formData();
  const media = form.get("image");
  const caption = String(form.get("caption") ?? "").trim().slice(0, 280);
  const kind = media instanceof File ? uploadKind(media) : null;
  const isImage = kind === "image";
  const isVideo = kind === "video";
  if (!(media instanceof File) || !kind) {
    return NextResponse.json({ error: "Choose a photo or video for your story." }, { status: 400 });
  }
  if ((isImage && media.size > MAX_IMAGE_SIZE) || (isVideo && media.size > MAX_VIDEO_SIZE)) {
    return NextResponse.json({ error: isVideo ? "Videos must be under 50 MB." : "Photos must be under 10 MB." }, { status: 400 });
  }

  const { DB, MEDIA } = bindings();
  const id = crypto.randomUUID();
  const extension = uploadExtension(media);
  const key = `${id}.${extension}`;
  const createdAt = Date.now();
  const expiresAt = createdAt + 24 * 60 * 60 * 1000;
  const mediaType = isVideo ? "video" : "image";
  await MEDIA.put(key, media.stream(), { httpMetadata: { contentType: uploadContentType(media, kind) } });
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
