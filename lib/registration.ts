import { bindings, ensureSchema } from "@/db/storage";

export type PendingRegistration = {
  authUserId: string;
  email: string;
  username: string;
  displayName: string;
  inviteCode: string | null;
  adultConfirmedAt: number;
  createdAt: number;
};

export function normalizeUsername(input: unknown) {
  return String(input || "").trim().replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "").slice(0, 30);
}

export function verifyAdultBirthDate(input: unknown) {
  const birthDate = String(input || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error("Enter your date of birth.");
  }
  const [year, month, day] = birthDate.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error("Enter a valid date of birth.");
  }
  const today = new Date();
  const cutoff = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
  const oldest = new Date(Date.UTC(today.getUTCFullYear() - 120, today.getUTCMonth(), today.getUTCDate()));
  if (parsed > cutoff) throw new Error("You must be at least 18 years old to register for VipKorner.");
  if (parsed < oldest) throw new Error("Enter a valid date of birth.");
  return Date.now();
}

export async function finalizePendingRegistration(authUserId: string, emailInput: string) {
  await ensureSchema();
  const { DB } = bindings();
  const email = emailInput.trim().toLowerCase();
  const existing = await DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
  if (existing) {
    await DB.prepare("DELETE FROM pending_registrations WHERE auth_user_id = ? OR email = ?").bind(authUserId, email).run();
    return { id: existing.id, created: false };
  }

  const pending = await DB.prepare(`SELECT auth_user_id AS authUserId, email, username,
      display_name AS displayName, invite_code AS inviteCode,
      adult_confirmed_at AS adultConfirmedAt, created_at AS createdAt
    FROM pending_registrations WHERE auth_user_id = ? OR email = ? LIMIT 1`)
    .bind(authUserId, email).first<PendingRegistration>();
  if (!pending) return null;

  const count = await DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
  const firstUser = !count?.total;
  const mode = await DB.prepare("SELECT value FROM app_meta WHERE key = 'registration_mode'").first<{ value: string }>();
  const inviteRequired = !firstUser && mode?.value !== "open";
  if (inviteRequired && !pending.inviteCode) throw new Error("This account needs an active invitation code.");

  const id = authUserId;
  const now = Date.now();
  const legacy = firstUser ? await DB.prepare("SELECT * FROM profile WHERE id = 'me'").first<Record<string, unknown>>() : null;
  if (pending.inviteCode) {
    const claim = await DB.prepare(`UPDATE invites SET claimed_by = ?, claimed_at = ?
      WHERE code = ? AND claimed_by IS NULL AND revoked = 0`).bind(id, now, pending.inviteCode).run();
    const changed = Number((claim.meta as { changes?: number } | undefined)?.changes || 0);
    if (!claim.success || changed !== 1) throw new Error("That invitation code is no longer available.");
  }

  try {
    await DB.prepare(`INSERT INTO users (
      id, email, username, display_name, bio, website, location, image_key, image_url, role, status,
      is_public, story_replies, high_quality_uploads, adult_confirmed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)`).bind(
      id,
      email,
      firstUser ? String(legacy?.username || pending.username) : pending.username,
      firstUser ? String(legacy?.display_name || pending.displayName) : pending.displayName,
      firstUser ? String(legacy?.bio || "") : "",
      firstUser ? String(legacy?.website || "") : "",
      firstUser ? String(legacy?.location || "") : "",
      firstUser ? legacy?.image_key || null : null,
      firstUser ? legacy?.image_url || null : null,
      firstUser ? "admin" : "user",
      Number(firstUser ? legacy?.story_replies ?? 1 : 1),
      Number(firstUser ? legacy?.high_quality_uploads ?? 1 : 1),
      pending.adultConfirmedAt,
      now,
    ).run();
  } catch (error) {
    if (pending.inviteCode) {
      await DB.prepare("UPDATE invites SET claimed_by = NULL, claimed_at = NULL WHERE code = ? AND claimed_by = ?")
        .bind(pending.inviteCode, id).run();
    }
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
  await DB.prepare("DELETE FROM pending_registrations WHERE auth_user_id = ? OR email = ?").bind(authUserId, email).run();
  return { id, created: true };
}
