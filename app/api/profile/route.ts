import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { authErrorResponse, publicUserFields, requireUser } from "@/lib/current-user";

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const user = await requireUser();
    const input = await request.json() as Record<string, unknown>;
    const username = String(input.username ?? user.username).trim().replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "").slice(0, 30);
    const displayName = String(input.displayName ?? user.displayName).trim().slice(0, 50);
    const bio = String(input.bio ?? user.bio).trim().slice(0, 160);
    const website = String(input.website ?? user.website).trim().slice(0, 100);
    const location = String(input.location ?? user.location).trim().slice(0, 80);
    const isPublic = input.privateAccount === undefined ? Number(Boolean(user.isPublic)) : Number(!Boolean(input.privateAccount));
    const storyReplies = input.storyReplies === undefined ? Number(Boolean(user.storyReplies)) : Number(Boolean(input.storyReplies));
    const highQualityUploads = input.highQualityUploads === undefined ? Number(Boolean(user.highQualityUploads)) : Number(Boolean(input.highQualityUploads));
    const savedCollectionPublic = input.savedCollectionPublic === undefined ? Number(Boolean(user.savedCollectionPublic)) : Number(Boolean(input.savedCollectionPublic));
    if (username.length < 3 || !displayName) return NextResponse.json({ error: "Name and a valid username are required." }, { status: 400 });
    const { DB } = bindings();
    const taken = await DB.prepare("SELECT id FROM users WHERE lower(username) = lower(?) AND id != ?").bind(username, user.id).first();
    if (taken) return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    await DB.prepare(`UPDATE users SET username = ?, display_name = ?, bio = ?, website = ?, location = ?,
      is_public = ?, story_replies = ?, high_quality_uploads = ?, saved_collection_public = ? WHERE id = ?`)
      .bind(username, displayName, bio, website, location, isPublic, storyReplies, highQualityUploads, savedCollectionPublic, user.id).run();
    const profile = await DB.prepare(`SELECT ${publicUserFields()} FROM users WHERE id = ?`).bind(user.id).first<Record<string, unknown>>();
    return NextResponse.json({ ...profile, privateAccount: !Boolean(profile?.isPublic) });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not update this profile." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const user = await requireUser();
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || !image.type.startsWith("image/")) return NextResponse.json({ error: "Choose a profile photo." }, { status: 400 });
    if (image.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Profile photos must be under 10 MB." }, { status: 400 });
    const { DB, MEDIA } = bindings();
    const key = `profile-${crypto.randomUUID()}.${image.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg"}`;
    await MEDIA.put(key, image.stream(), { httpMetadata: { contentType: image.type } });
    await DB.prepare("UPDATE users SET image_key = ?, image_url = NULL WHERE id = ?").bind(key, user.id).run();
    const profile = await DB.prepare(`SELECT ${publicUserFields()} FROM users WHERE id = ?`).bind(user.id).first<Record<string, unknown>>();
    return NextResponse.json({ ...profile, privateAccount: !Boolean(profile?.isPublic) });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not update this photo." }, { status: 500 }); }
}
