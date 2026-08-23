import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";

export async function POST(request: Request) {
  await ensureSchema();
  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return NextResponse.json({ error: "Choose an image for your story." }, { status: 400 });
  }
  if (image.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Images must be under 10 MB." }, { status: 400 });
  }

  const { DB, MEDIA } = bindings();
  const id = crypto.randomUUID();
  const key = `${id}.${image.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg"}`;
  const createdAt = Date.now();
  const expiresAt = createdAt + 24 * 60 * 60 * 1000;
  await MEDIA.put(key, image.stream(), { httpMetadata: { contentType: image.type } });
  await DB.prepare("INSERT INTO stories (id, image_key, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(id, key, createdAt, expiresAt)
    .run();

  return NextResponse.json({ id, imageKey: key, imageUrl: null, createdAt, expiresAt }, { status: 201 });
}
