import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { inspectMediaMetadata } from "@/lib/media-upload";
import { authErrorResponse, publicUserFields, requireUser } from "@/lib/current-user";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const KEY_PATTERN = /^([0-9a-f-]{36})\.(jpg|png|webp|gif|mp4|webm|mov)$/;

type UploadPart = { partNumber: number; etag: string };

class UploadInputError extends Error {}

export async function POST(request: Request) {
  try {
  await ensureSchema();
  const user = await requireUser();
  const payload = await request.json() as {
    action?: "start" | "complete";
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    signature?: number[];
    uploadId?: string;
    key?: string;
    parts?: UploadPart[];
    contentKind?: "post" | "story" | "profile";
    caption?: string;
    captionX?: number;
    captionY?: number;
    postId?: string;
    position?: number;
    itemCaption?: string;
  };
  const { DB, MEDIA } = bindings();

  if (payload.action === "start") {
    const media = inspectMediaMetadata(String(payload.fileName || ""), String(payload.fileType || ""), Uint8Array.from(payload.signature || []));
    const fileSize = Number(payload.fileSize || 0);
    if (!media || !fileSize) return NextResponse.json({ error: "This file is not a supported photo or video." }, { status: 400 });
    if (payload.contentKind === "profile" && (media.kind !== "image" || media.extension === "gif")) return NextResponse.json({ error: "Choose a JPG, PNG or WebP profile photo." }, { status: 400 });
    const limit = media.kind === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (fileSize > limit) return NextResponse.json({ error: media.kind === "video" ? "Videos must be under 50 MB." : "Photos must be under 10 MB." }, { status: 400 });

    const id = crypto.randomUUID();
    const key = `${id}.${media.extension}`;
    const upload = await MEDIA.createMultipartUpload(key, { httpMetadata: { contentType: media.contentType } });
    return NextResponse.json({ id, key, uploadId: upload.uploadId, mediaType: media.kind });
  }

  if (payload.action === "complete") {
    const match = String(payload.key || "").match(KEY_PATTERN);
    const parts = Array.isArray(payload.parts) ? payload.parts : [];
    if (!match || !payload.uploadId || !parts.length || !["post", "story", "profile"].includes(payload.contentKind || "")) {
      return NextResponse.json({ error: "Upload could not be completed." }, { status: 400 });
    }
    const [, id, extension] = match;
    const mediaType = ["mp4", "webm", "mov"].includes(extension) ? "video" : "image";
    if (payload.contentKind === "profile" && mediaType !== "image") return NextResponse.json({ error: "Profile photos must be images." }, { status: 400 });
    await MEDIA.resumeMultipartUpload(payload.key!, payload.uploadId).complete(parts);
    const createdAt = Date.now();
    const caption = String(payload.caption || "").trim();
    try {
      if (payload.contentKind === "profile") {
        const current = await DB.prepare("SELECT image_key AS imageKey FROM users WHERE id = ?").bind(user.id).first<{ imageKey: string | null }>();
        await DB.prepare("UPDATE users SET image_key = ?, image_url = NULL WHERE id = ?").bind(payload.key, user.id).run();
        if (current?.imageKey && current.imageKey !== payload.key) await MEDIA.delete(current.imageKey);
        const profile = await DB.prepare(`SELECT ${publicUserFields()} FROM users WHERE id = ?`).bind(user.id).first<Record<string, unknown>>();
        return NextResponse.json({ ...profile, privateAccount: !Boolean(profile?.isPublic) }, { status: 201 });
      }
      if (payload.contentKind === "story") {
        const storyCaption = caption.slice(0, 280);
        const captionX = Math.max(10, Math.min(90, Number(payload.captionX ?? 50)));
        const captionY = Math.max(12, Math.min(88, Number(payload.captionY ?? 82)));
        const expiresAt = createdAt + 24 * 60 * 60 * 1000;
        await DB.prepare("INSERT INTO stories (id, user_id, caption, image_key, media_type, created_at, expires_at, caption_x, caption_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(id, user.id, storyCaption, payload.key, mediaType, createdAt, expiresAt, captionX, captionY).run();
        return NextResponse.json({ id, userId: user.id, caption: storyCaption, captionX, captionY, imageKey: payload.key, imageUrl: null, mediaType, createdAt, expiresAt, owned: true }, { status: 201 });
      }
      const postId = String(payload.postId || id);
      const position = Number(payload.position ?? 0);
      if (!Number.isInteger(position) || position < 0 || position > 9) {
        throw new UploadInputError("A carousel can contain up to 10 items.");
      }
      const postCaption = caption.slice(0, 500) || "A new moment.";
      const itemCaption = String(payload.itemCaption || "").trim().slice(0, 280);
      if (position === 0) {
        await DB.prepare("INSERT INTO posts (id, user_id, caption, image_key, media_type, likes, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)")
          .bind(postId, user.id, postCaption, payload.key, mediaType, createdAt).run();
      } else {
        const parent = await DB.prepare("SELECT user_id AS userId FROM posts WHERE id = ?").bind(postId).first<{ userId: string }>();
        if (!parent || parent.userId !== user.id) throw new Error("The carousel post could not be found.");
        const count = await DB.prepare("SELECT COUNT(*) AS count FROM post_media WHERE post_id = ?").bind(postId).first<{ count: number }>();
        if (Number(count?.count || 0) >= 10) throw new UploadInputError("A carousel can contain up to 10 items.");
      }
      await DB.prepare("INSERT INTO post_media (id, post_id, position, caption, image_key, media_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(id, postId, position, itemCaption, payload.key, mediaType, createdAt).run();
      return NextResponse.json({ id: postId, mediaId: id, userId: user.id, caption: postCaption, itemCaption, position, imageKey: payload.key, imageUrl: null, mediaType, likes: 0, liked: 0, saved: 0, createdAt, owned: true }, { status: 201 });
    } catch (error) {
      await MEDIA.delete(payload.key!);
      throw error;
    }
  }

  return NextResponse.json({ error: "Unknown upload action." }, { status: 400 });
  } catch (error) { return authErrorResponse(error) || (error instanceof UploadInputError ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ error: "Could not process this upload." }, { status: 500 })); }
}

export async function PUT(request: Request) {
  try {
  await requireUser();
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  const uploadId = url.searchParams.get("uploadId") || "";
  const partNumber = Number(url.searchParams.get("partNumber"));
  if (!KEY_PATTERN.test(key) || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || !request.body) {
    return NextResponse.json({ error: "Invalid upload part." }, { status: 400 });
  }
  const part = await bindings().MEDIA.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, request.body);
  return NextResponse.json({ partNumber: part.partNumber, etag: part.etag });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not upload this part." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
  await requireUser();
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  const uploadId = url.searchParams.get("uploadId") || "";
  if (!KEY_PATTERN.test(key) || !uploadId) return NextResponse.json({ aborted: true });
  await bindings().MEDIA.resumeMultipartUpload(key, uploadId).abort();
  return NextResponse.json({ aborted: true });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not cancel this upload." }, { status: 500 }); }
}
