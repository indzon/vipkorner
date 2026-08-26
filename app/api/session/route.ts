import { NextResponse } from "next/server";
import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { bindings, ensureSchema } from "@/db/storage";
import { identityEmail, publicUserFields } from "@/lib/current-user";
import { supabaseConfigured } from "@/lib/supabase-server";

function normalizeUsername(input: unknown) {
  return String(input || "").trim().replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "").slice(0, 30);
}

export async function GET() {
  await ensureSchema();
  const { DB } = bindings();
  const count = await DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
  const bootstrapRequired = !count?.total;
  const identity = await identityEmail();
  const authProvider = supabaseConfigured() ? "supabase" : "chatgpt";
  if (!identity) return NextResponse.json({
    authenticated: false,
    authProvider,
    bootstrapRequired,
    inviteRequired: !bootstrapRequired,
    signInPath: authProvider === "supabase" ? "/login" : chatGPTSignInPath("/login"),
  });
  const user = await DB.prepare(`SELECT ${publicUserFields()} FROM users WHERE email = ?`).bind(identity.email).first();
  const reservedInvite = !bootstrapRequired && !user
    ? await DB.prepare(`SELECT code FROM invites WHERE lower(reserved_email) = lower(?)
      AND claimed_by IS NULL AND revoked = 0 LIMIT 1`).bind(identity.email).first<{ code: string }>()
    : null;
  const legacy = bootstrapRequired
    ? await DB.prepare("SELECT username, display_name AS displayName FROM profile WHERE id = 'me'").first<{ username: string; displayName: string }>()
    : null;
  return NextResponse.json({
    authenticated: true,
    authProvider,
    identity: { displayName: identity.displayName },
    user,
    suggestedUsername: legacy?.username || undefined,
    suggestedDisplayName: legacy?.displayName || undefined,
    bootstrapRequired,
    inviteRequired: Boolean(count?.total),
    inviteReserved: Boolean(reservedInvite),
    signOutPath: authProvider === "supabase" ? "/api/auth" : chatGPTSignOutPath("/login"),
  });
}

export async function POST(request: Request) {
  await ensureSchema();
  const identity = await identityEmail();
  if (!identity) return NextResponse.json({ error: "Sign in first.", signInPath: supabaseConfigured() ? "/login" : chatGPTSignInPath("/login") }, { status: 401 });
  const input = await request.json() as { username?: string; displayName?: string; inviteCode?: string; adult?: boolean };
  if (!input.adult) return NextResponse.json({ error: "You must confirm that you are at least 18 years old." }, { status: 400 });
  const { DB } = bindings();
  const count = await DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
  const firstUser = !count?.total;
  const legacy = firstUser ? await DB.prepare("SELECT * FROM profile WHERE id = 'me'").first<Record<string, unknown>>() : null;
  const username = normalizeUsername(input.username || legacy?.username);
  const displayName = String(input.displayName || legacy?.display_name || identity.displayName).trim().slice(0, 50);
  if (username.length < 3 || !displayName) return NextResponse.json({ error: "Choose a username with at least 3 letters, numbers, dots, or underscores." }, { status: 400 });
  const existing = await DB.prepare("SELECT id FROM users WHERE email = ? OR lower(username) = lower(?)").bind(identity.email, username).first<{ id: string }>();
  if (existing) return NextResponse.json({ error: "That account or username is already registered." }, { status: 409 });
  let inviteCode: string | null = null;
  let inviteWasReserved = false;
  if (!firstUser) {
    const code = String(input.inviteCode || "").trim().toUpperCase();
    const invite = await DB.prepare(`SELECT code, reserved_email AS reservedEmail FROM invites
      WHERE claimed_by IS NULL AND revoked = 0
      AND ((lower(reserved_email) = lower(?)) OR (code = ? AND reserved_email IS NULL))
      ORDER BY CASE WHEN lower(reserved_email) = lower(?) THEN 0 ELSE 1 END LIMIT 1`)
      .bind(identity.email, code, identity.email).first<{ code: string; reservedEmail: string | null }>();
    if (!invite) return NextResponse.json({ error: "Enter a valid, active, unused invite code." }, { status: 403 });
    inviteCode = invite.code;
    inviteWasReserved = Boolean(invite.reservedEmail);
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  if (inviteCode) {
    const claim = await DB.prepare(`UPDATE invites SET claimed_by = ?, claimed_at = ?, reserved_email = NULL, reserved_at = NULL
      WHERE code = ? AND claimed_by IS NULL AND revoked = 0
      AND (reserved_email IS NULL OR lower(reserved_email) = lower(?))`).bind(id, now, inviteCode, identity.email).run();
    const changed = Number((claim.meta as { changes?: number } | undefined)?.changes || 0);
    if (!claim.success || changed !== 1) return NextResponse.json({ error: "That invite code was just claimed or deactivated. Ask an administrator for another code." }, { status: 409 });
  }
  try {
    await DB.prepare(`INSERT INTO users (
      id, email, username, display_name, bio, website, location, image_key, image_url, role, status,
      is_public, story_replies, high_quality_uploads, adult_confirmed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)`)
      .bind(id, identity.email, username, displayName,
        firstUser ? String(legacy?.bio || "") : "", firstUser ? String(legacy?.website || "") : "",
        firstUser ? String(legacy?.location || "") : "", firstUser ? legacy?.image_key || null : null,
        firstUser ? legacy?.image_url || null : null, firstUser ? "admin" : "user",
        Number(firstUser ? legacy?.story_replies ?? 1 : 1), Number(firstUser ? legacy?.high_quality_uploads ?? 1 : 1), now, now).run();
  } catch (error) {
    if (inviteCode) await DB.prepare(`UPDATE invites SET claimed_by = NULL, claimed_at = NULL,
      reserved_email = ?, reserved_at = ? WHERE code = ? AND claimed_by = ?`)
      .bind(inviteWasReserved ? identity.email : null, inviteWasReserved ? now : null, inviteCode, id).run();
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
  }
  const user = await DB.prepare(`SELECT ${publicUserFields()} FROM users WHERE id = ?`).bind(id).first();
  return NextResponse.json({ user, bootstrap: firstUser }, { status: 201 });
}
