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
  const image = form.get("image");
  const caption = String(form.get("caption") ?? "").trim();

  const kind = image instanceof File ? uploadKind(image) : null;
  const isImage = kind === "image";
  const isVideo = kind === "video";
  if (!(image instanceof File) || !kind) {
    return NextResponse.json({ error: "Choose a photo or video to share." }, { status: 400 });
  }
  if ((isImage && image.size > MAX_IMAGE_SIZE) || (isVideo && image.size > MAX_VIDEO_SIZE)) {
    return NextResponse.json({ error: isVideo ? "Videos must be under 50 MB." : "Images must be under 10 MB." }, { status: 400 });
  }

  const { DB, MEDIA } = bindings();
  const id = crypto.randomUUID();
  const key = `${id}.${uploadExtension(image)}`;
  const createdAt = Date.now();
  await MEDIA.put(key, image.stream(), { httpMetadata: { contentType: uploadContentType(image, kind) } });
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

export async function PUT(request: Request) {
  await ensureSchema();
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const media = form.get("image");
  const kind = media instanceof File ? uploadKind(media) : null;
  const isImage = kind === "image";
  const isVideo = kind === "video";

  if (!id || !(media instanceof File) || !kind) {
    return NextResponse.json({ error: "Choose a photo or video to replace this media." }, { status: 400 });
  }
  if ((isImage && media.size > MAX_IMAGE_SIZE) || (isVideo && media.size > MAX_VIDEO_SIZE)) {
    return NextResponse.json({ error: isVideo ? "Videos must be under 50 MB." : "Images must be under 10 MB." }, { status: 400 });
  }

  const { DB, MEDIA } = bindings();
  const current = await DB.prepare("SELECT image_key AS imageKey FROM posts WHERE id = ?").bind(id).first<{ imageKey: string | null }>();
  if (!current) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  const extension = uploadExtension(media);
  const key = `${id}-${crypto.randomUUID()}.${extension}`;
  const mediaType = isVideo ? "video" : "image";
  await MEDIA.put(key, media.stream(), { httpMetadata: { contentType: uploadContentType(media, kind) } });
  await DB.prepare("UPDATE posts SET image_key = ?, image_url = NULL, media_type = ? WHERE id = ?").bind(key, mediaType, id).run();
  if (current.imageKey && current.imageKey !== key) await MEDIA.delete(current.imageKey);

  return NextResponse.json({ id, imageKey: key, imageUrl: null, mediaType });
}

export async function DELETE(request: Request) {
  await ensureSchema();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Post id is required." }, { status: 400 });

  const { DB, MEDIA } = bindings();
  const post = await DB.prepare("SELECT image_key AS imageKey FROM posts WHERE id = ?").bind(id).first<{ imageKey: string | null }>();
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  await DB.batch([
    DB.prepare("DELETE FROM comments WHERE post_id = ?").bind(id),
    DB.prepare("DELETE FROM activities WHERE post_id = ?").bind(id),
    DB.prepare("DELETE FROM posts WHERE id = ?").bind(id),
  ]);
  if (post.imageKey) await MEDIA.delete(post.imageKey);
  return NextResponse.json({ deleted: true });
}
