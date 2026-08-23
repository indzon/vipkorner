import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";

export async function PATCH(request: Request) {
  await ensureSchema();
  const input = await request.json() as Record<string, unknown>;
  const { DB } = bindings();

  const current = await DB.prepare("SELECT * FROM profile WHERE id = 'me'").first<Record<string, unknown>>();
  if (!current) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const value = (key: string, fallback: unknown) => input[key] === undefined ? fallback : input[key];
  const username = String(value("username", current.username)).trim().replace(/^@/, "").slice(0, 30);
  const displayName = String(value("displayName", current.display_name)).trim().slice(0, 50);
  const bio = String(value("bio", current.bio)).trim().slice(0, 160);
  const website = String(value("website", current.website)).trim().slice(0, 100);
  const location = String(value("location", current.location)).trim().slice(0, 80);
  const privateAccount = Number(Boolean(value("privateAccount", current.private_account)));
  const storyReplies = Number(Boolean(value("storyReplies", current.story_replies)));
  const highQualityUploads = Number(Boolean(value("highQualityUploads", current.high_quality_uploads)));

  if (!username || !displayName) return NextResponse.json({ error: "Name and username are required." }, { status: 400 });

  await DB.prepare(`UPDATE profile SET
    username = ?, display_name = ?, bio = ?, website = ?, location = ?,
    private_account = ?, story_replies = ?, high_quality_uploads = ?
    WHERE id = 'me'`)
    .bind(username, displayName, bio, website, location, privateAccount, storyReplies, highQualityUploads)
    .run();

  return NextResponse.json({ username, displayName, bio, website, location, privateAccount, storyReplies, highQualityUploads });
}
