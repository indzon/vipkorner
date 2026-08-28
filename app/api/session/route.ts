import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { identityEmail, publicUserFields } from "@/lib/current-user";
import { normalizeUsername, verifyAdultBirthDate } from "@/lib/registration";

export async function GET() {
  await ensureSchema();
  const { DB } = bindings();
  const count = await DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
  const mode = await DB.prepare("SELECT value FROM app_meta WHERE key = 'registration_mode'").first<{ value: string }>();
  const bootstrapRequired = !count?.total;
  const inviteRequired = Boolean(count?.total) && mode?.value !== "open";
  const identity = await identityEmail();
  if (!identity) return NextResponse.json({ authenticated: false, signInPath: "/login", bootstrapRequired, inviteRequired, registrationMode: mode?.value || "invite" });
  const user = await DB.prepare(`SELECT ${publicUserFields("", true)} FROM users WHERE email = ?`).bind(identity.email).first();
  return NextResponse.json({
    authenticated: true,
    identity: { displayName: identity.displayName, inviteCode: identity.inviteCode },
    user,
    bootstrapRequired,
    inviteRequired,
    registrationMode: mode?.value || "invite",
    signOutPath: "/api/auth",
  });
}

export async function POST(request: Request) {
  await ensureSchema();
  const identity = await identityEmail();
  if (!identity) return NextResponse.json({ error: "Sign in first.", signInPath: "/login" }, { status: 401 });
  const input = await request.json() as { username?: string; displayName?: string; inviteCode?: string; birthDate?: string };
  let adultConfirmedAt: number;
  try {
    adultConfirmedAt = verifyAdultBirthDate(input.birthDate);
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "Enter a valid date of birth." }, { status: 400 });
  }
  const username = normalizeUsername(input.username);
  const displayName = String(input.displayName || identity.displayName).trim().slice(0, 50);
  const { DB } = bindings();
  const count = await DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
  const firstUser = !count?.total;
  if (!firstUser && (username.length < 3 || !displayName)) return NextResponse.json({ error: "Choose a username with at least 3 letters, numbers, dots, or underscores." }, { status: 400 });
  const existing = firstUser
    ? await DB.prepare("SELECT id FROM users WHERE email = ?").bind(identity.email).first<{ id: string }>()
    : await DB.prepare("SELECT id FROM users WHERE email = ? OR lower(username) = lower(?)").bind(identity.email, username).first<{ id: string }>();
  if (existing) return NextResponse.json({ error: "That account or username is already registered." }, { status: 409 });
  let inviteCode: string | null = null;
  if (!firstUser) {
    const mode = await DB.prepare("SELECT value FROM app_meta WHERE key = 'registration_mode'").first<{ value: string }>();
    if (mode?.value !== "open") {
      const code = String(input.inviteCode || identity.inviteCode || "").trim().toUpperCase();
      const invite = await DB.prepare("SELECT code FROM invites WHERE code = ? AND claimed_by IS NULL AND revoked = 0").bind(code).first<{ code: string }>();
      if (!invite) return NextResponse.json({ error: "Enter a valid, unused invite code." }, { status: 403 });
      inviteCode = invite.code;
    }
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const legacy = firstUser ? await DB.prepare("SELECT * FROM profile WHERE id = 'me'").first<Record<string, unknown>>() : null;
  if (inviteCode) {
    const claim = await DB.prepare(`UPDATE invites SET claimed_by = ?, claimed_at = ?
      WHERE code = ? AND claimed_by IS NULL AND revoked = 0`).bind(id, now, inviteCode).run();
    const changed = Number((claim.meta as { changes?: number } | undefined)?.changes || 0);
    if (!claim.success || changed !== 1) return NextResponse.json({ error: "That invite code was just claimed or deactivated. Ask an administrator for another code." }, { status: 409 });
  }
  try {
    await DB.prepare(`INSERT INTO users (
      id, email, username, display_name, bio, website, location, show_location, image_key, image_url, role, status,
      is_public, story_replies, high_quality_uploads, adult_confirmed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)`)
      .bind(id, identity.email, firstUser ? String(legacy?.username || username) : username,
        firstUser ? String(legacy?.display_name || displayName) : displayName,
        firstUser ? String(legacy?.bio || "") : "", firstUser ? String(legacy?.website || "") : "",
        firstUser ? String(legacy?.location || "") : "", firstUser ? 1 : 0, firstUser ? legacy?.image_key || null : null,
        firstUser ? legacy?.image_url || null : null, firstUser ? "admin" : "user",
        Number(firstUser ? legacy?.story_replies ?? 1 : 1), Number(firstUser ? legacy?.high_quality_uploads ?? 1 : 1), adultConfirmedAt, now).run();
  } catch (error) {
    if (inviteCode) await DB.prepare("UPDATE invites SET claimed_by = NULL, claimed_at = NULL WHERE code = ? AND claimed_by = ?").bind(inviteCode, id).run();
    throw error;
  }
  if (firstUser) {
    await DB.batch([
      DB.prepare("UPDATE posts SET user_id = ? WHERE user_id IS NULL").bind(id),
      DB.prepare("UPDATE stories SET user_id = ? WHERE user_id IS NULL").bind(id),
      DB.prepare("UPDATE comments SET user_id = ? WHERE user_id IS NULL").bind(id),
      DB.prepare("INSERT OR IGNORE INTO post_likes (post_id, user_id, created_at) SELECT id, ?, ? FROM posts WHERE liked = 1").bind(id, now),
      DB.prepare("INSERT OR IGNORE INTO post_saves (post_id, user_id, created_at) SELECT id, ?, ? FROM posts WHERE saved = 1").bind(id, now),
      DB.prepare("UPDATE posts SET likes = MAX(0, likes - 1), liked = 0 WHERE liked = 1"),
      DB.prepare("UPDATE posts SET saved = 0 WHERE saved = 1"),
    ]);
  } else {
    await DB.prepare(`INSERT OR IGNORE INTO follows (follower_id, followed_id, created_at)
      SELECT ?, id, ? FROM users WHERE role = 'admin' AND status = 'active' ORDER BY created_at ASC LIMIT 1`).bind(id, now).run();
  }
  const user = await DB.prepare(`SELECT ${publicUserFields("", true)} FROM users WHERE id = ?`).bind(id).first();
  return NextResponse.json({ user, bootstrap: firstUser }, { status: 201 });
}
