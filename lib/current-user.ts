import { bindings, ensureSchema } from "@/db/storage";
import { supabaseConfigured, supabaseServerClient } from "@/lib/supabase-server";

export type AppUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  website: string;
  location: string;
  imageKey: string | null;
  imageUrl: string | null;
  heroImageKey: string | null;
  heroImageUrl: string | null;
  role: "admin" | "user";
  status: "active" | "suspended";
  isPublic: number | boolean;
  storyReplies: number | boolean;
  highQualityUploads: number | boolean;
  savedCollectionPublic: number | boolean;
  createdAt: number;
};

const USER_SELECT = `id, email, username, display_name AS displayName, bio, website, location,
  image_key AS imageKey, image_url AS imageUrl, hero_image_key AS heroImageKey, hero_image_url AS heroImageUrl, role, status, is_public AS isPublic,
  story_replies AS storyReplies, high_quality_uploads AS highQualityUploads,
  saved_collection_public AS savedCollectionPublic, created_at AS createdAt`;

export async function identityEmail() {
  if (supabaseConfigured()) {
    const client = await supabaseServerClient();
    const { data } = await client!.auth.getUser();
    const user = data.user;
    if (user?.email) return {
      email: user.email.toLowerCase(),
      displayName: String(user.user_metadata?.display_name || user.email),
      inviteCode: String(user.user_metadata?.invite_code || "").trim().toUpperCase(),
    };
  }
  if (process.env.NODE_ENV === "development") return { email: "local-admin@vipkorner.test", displayName: "Local Admin", inviteCode: "" };
  return null;
}

export async function currentUser(): Promise<AppUser | null> {
  await ensureSchema();
  const identity = await identityEmail();
  if (!identity) return null;
  return bindings().DB.prepare(`SELECT ${USER_SELECT} FROM users WHERE email = ?`).bind(identity.email).first<AppUser>();
}

export async function requireUser(): Promise<AppUser> {
  const user = await currentUser();
  if (!user) throw new AuthError("Sign in and finish setting up your VipKorner account.", 401);
  if (user.status !== "active") throw new AuthError("This account is suspended. Contact the VipKorner administrator.", 403);
  return user;
}

export class AuthError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function authErrorResponse(error: unknown) {
  if (!(error instanceof AuthError)) return null;
  return Response.json({ error: error.message, signInPath: "/login" }, { status: error.status });
}

export async function blockedBetween(firstId: string, secondId: string) {
  const row = await bindings().DB.prepare(`SELECT 1 AS blocked FROM blocks
    WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1`)
    .bind(firstId, secondId, secondId, firstId).first();
  return Boolean(row);
}

export function publicUserFields(prefix = "") {
  const p = prefix ? `${prefix}.` : "";
  return `${p}id, ${p}username, ${p}display_name AS displayName, ${p}bio, ${p}website,
    ${p}location, ${p}image_key AS imageKey, ${p}image_url AS imageUrl,
    ${p}hero_image_key AS heroImageKey, ${p}hero_image_url AS heroImageUrl, ${p}role,
    ${p}status, ${p}is_public AS isPublic, ${p}story_replies AS storyReplies,
    ${p}high_quality_uploads AS highQualityUploads, ${p}saved_collection_public AS savedCollectionPublic, ${p}created_at AS createdAt`;
}
