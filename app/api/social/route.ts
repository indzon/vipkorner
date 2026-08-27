import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { authErrorResponse, blockedBetween, requireUser } from "@/lib/current-user";

async function connectionCounts(DB: D1Database, userId: string) {
  const [following, followers] = await Promise.all([
    DB.prepare("SELECT COUNT(*) AS total FROM follows WHERE follower_id = ?").bind(userId).first<{ total: number }>(),
    DB.prepare("SELECT COUNT(*) AS total FROM follows WHERE followed_id = ?").bind(userId).first<{ total: number }>(),
  ]);
  return { following: following?.total || 0, followers: followers?.total || 0 };
}

export async function GET(request: Request) {
  try {
    await ensureSchema(); const viewer = await requireUser(); const { DB } = bindings();
    const params = new URL(request.url).searchParams;
    if (params.get("counts") === "1") {
      return NextResponse.json({ counts: await connectionCounts(DB, viewer.id) });
    }
    const profileId = params.get("profile")?.trim();
    if (profileId) {
      const profile = await DB.prepare(`SELECT u.id, u.username, u.display_name AS displayName,
        u.bio, u.website, u.location, u.image_key AS imageKey, u.image_url AS imageUrl,
        u.hero_image_key AS heroImageKey, u.hero_image_url AS heroImageUrl,
        u.is_public AS isPublic,
        EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followed_id = u.id) AS following,
        EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followed_id = ?) AS followsYou,
        (SELECT fr.status FROM follow_requests fr WHERE fr.requester_id = ? AND fr.target_id = u.id) AS followRequestStatus,
        (SELECT COUNT(*) FROM follows f WHERE f.followed_id = u.id) AS followers,
        (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id) AS followingCount,
        (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS posts,
        (u.id = ?) AS isSelf
        FROM users u WHERE u.id = ? AND u.status = 'active'
        AND NOT EXISTS(SELECT 1 FROM blocks b WHERE
          (b.blocker_id = ? AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?))`)
        .bind(viewer.id, viewer.id, viewer.id, viewer.id, profileId, viewer.id, viewer.id).first<Record<string, unknown>>();
      if (!profile) return NextResponse.json({ error: "This profile is unavailable." }, { status: 404 });
      const canViewPosts = Boolean(profile.isPublic) || Boolean(profile.following) || Boolean(profile.isSelf);
      const hero = canViewPosts && !profile.heroImageKey && !profile.heroImageUrl ? await DB.prepare(`SELECT p.image_key AS heroImageKey, p.image_url AS heroImageUrl
        FROM posts p WHERE p.user_id = ? AND (p.image_key IS NOT NULL OR p.image_url IS NOT NULL)
        ORDER BY p.created_at DESC LIMIT 1`).bind(profileId).first() : null;
      return NextResponse.json({ profile: { ...profile, heroImageKey: profile.heroImageKey || hero?.heroImageKey || null, heroImageUrl: profile.heroImageUrl || hero?.heroImageUrl || null } });
    }
    const list = params.get("list");
    if (list === "followers" || list === "following") {
      const join = list === "followers" ? "f.follower_id = u.id" : "f.followed_id = u.id";
      const owner = list === "followers" ? "f.followed_id" : "f.follower_id";
      const connections = await DB.prepare(`SELECT u.id, u.username, u.display_name AS displayName,
        u.bio, u.location, u.image_key AS imageKey, u.image_url AS imageUrl,
        f.created_at AS connectedAt
        FROM follows f JOIN users u ON ${join}
        WHERE ${owner} = ? AND u.status = 'active'
        ORDER BY f.created_at DESC`).bind(viewer.id).all();
      return NextResponse.json({ connections: connections.results, counts: await connectionCounts(DB, viewer.id) });
    }
    const query = params.get("q")?.trim().slice(0, 60) || "";
    const users = await DB.prepare(`SELECT u.id, u.username, u.display_name AS displayName, u.bio, u.location,
      u.image_key AS imageKey, u.image_url AS imageUrl, u.role, u.is_public AS isPublic,
      EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followed_id = u.id) AS following,
      EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followed_id = ?) AS followsYou,
      (SELECT fr.status FROM follow_requests fr WHERE fr.requester_id = ? AND fr.target_id = u.id) AS followRequestStatus,
      (SELECT COUNT(*) FROM follows f WHERE f.followed_id = u.id) AS followers,
      (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS posts,
      EXISTS(SELECT 1 FROM blocks b WHERE b.blocker_id = ? AND b.blocked_id = u.id) AS blocked,
      (u.id = ?) AS isSelf
      FROM users u WHERE u.status = 'active'
      AND (u.id = ? OR (
        NOT EXISTS(SELECT 1 FROM blocks b WHERE b.blocker_id = u.id AND b.blocked_id = ?)
      ))
      AND (? = '' OR lower(u.username) LIKE lower(?) OR lower(u.display_name) LIKE lower(?))
      ORDER BY followers DESC, u.created_at DESC LIMIT 40`)
      .bind(viewer.id, viewer.id, viewer.id, viewer.id, viewer.id, viewer.id, viewer.id, query, `%${query}%`, `%${query}%`).all();
    const unread = await DB.prepare("SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL").bind(viewer.id).first<{ total: number }>();
    const admin = viewer.role === "admin" ? {
      invites: (await DB.prepare(`SELECT i.code, i.created_at AS createdAt, i.claimed_at AS claimedAt, i.revoked,
        claimed.username AS claimedUsername, creator.username AS creatorUsername FROM invites i
        LEFT JOIN users claimed ON claimed.id = i.claimed_by
        LEFT JOIN users creator ON creator.id = i.created_by
        ORDER BY i.created_at DESC LIMIT 50`).all()).results,
      reports: (await DB.prepare(`SELECT r.id, r.target_type AS targetType, r.target_id AS targetId, r.reason, r.status,
        r.created_at AS createdAt, u.username AS reporterUsername FROM reports r JOIN users u ON u.id = r.reporter_id
        ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 50`).all()).results,
      members: (await DB.prepare("SELECT id, username, display_name AS displayName, status FROM users WHERE role != 'admin' ORDER BY created_at DESC LIMIT 100").all()).results,
      registrationMode: (await DB.prepare("SELECT value FROM app_meta WHERE key = 'registration_mode'").first<{ value: string }>())?.value || "invite",
    } : null;
    return NextResponse.json({ users: users.results, unread: unread?.total || 0, admin });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not load people." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    await ensureSchema(); const viewer = await requireUser(); const { DB } = bindings();
    const input = await request.json() as { action?: string; targetId?: string; targetType?: string; reason?: string; mode?: string; reportId?: string; code?: string; decision?: string };
    const targetId = String(input.targetId || ""); const now = Date.now();
    if (input.action === "follow") {
      if (!targetId || targetId === viewer.id || await blockedBetween(viewer.id, targetId)) return NextResponse.json({ error: "This profile cannot be followed." }, { status: 403 });
      const target = await DB.prepare("SELECT username, is_public AS isPublic FROM users WHERE id = ? AND status = 'active'").bind(targetId).first<{ username: string; isPublic: number }>();
      if (!target) return NextResponse.json({ error: "This profile is unavailable." }, { status: 404 });
      const exists = await DB.prepare("SELECT 1 AS active FROM follows WHERE follower_id = ? AND followed_id = ?").bind(viewer.id, targetId).first();
      if (exists) {
        await DB.prepare("DELETE FROM follows WHERE follower_id = ? AND followed_id = ?").bind(viewer.id, targetId).run();
        return NextResponse.json({ following: false, requested: false, counts: await connectionCounts(DB, viewer.id) });
      }
      if (!target.isPublic) {
        const pending = await DB.prepare("SELECT status FROM follow_requests WHERE requester_id = ? AND target_id = ?").bind(viewer.id, targetId).first<{ status: string }>();
        if (pending?.status === "pending") {
          await DB.prepare("UPDATE follow_requests SET status = 'canceled', responded_at = ? WHERE requester_id = ? AND target_id = ? AND status = 'pending'").bind(now, viewer.id, targetId).run();
          return NextResponse.json({ following: false, requested: false, counts: await connectionCounts(DB, viewer.id) });
        }
        await DB.batch([
          DB.prepare(`INSERT INTO follow_requests (requester_id, target_id, status, created_at, responded_at)
            VALUES (?, ?, 'pending', ?, NULL)
            ON CONFLICT(requester_id, target_id) DO UPDATE SET status = 'pending', created_at = excluded.created_at, responded_at = NULL`).bind(viewer.id, targetId, now),
          DB.prepare("INSERT INTO notifications (id, user_id, actor_id, type, entity_id, message, created_at) VALUES (?, ?, ?, 'follow_request', ?, ?, ?)")
            .bind(crypto.randomUUID(), targetId, viewer.id, viewer.id, `@${viewer.username} requested to follow you.`, now),
        ]);
        return NextResponse.json({ following: false, requested: true, counts: await connectionCounts(DB, viewer.id) });
      }
      {
        await DB.prepare("INSERT INTO follows (follower_id, followed_id, created_at) VALUES (?, ?, ?)").bind(viewer.id, targetId, now).run();
        await DB.prepare("INSERT INTO notifications (id, user_id, actor_id, type, entity_id, message, created_at) VALUES (?, ?, ?, 'follow', ?, ?, ?)")
          .bind(crypto.randomUUID(), targetId, viewer.id, viewer.id, `@${viewer.username} followed you.`, now).run();
      }
      return NextResponse.json({ following: true, requested: false, counts: await connectionCounts(DB, viewer.id) });
    }
    if (input.action === "follow-request-response") {
      if (!targetId || !["approve", "decline"].includes(input.decision || "")) return NextResponse.json({ error: "Choose a follow request and response." }, { status: 400 });
      const requestRow = await DB.prepare(`SELECT fr.status, requester.username
        FROM follow_requests fr JOIN users requester ON requester.id = fr.requester_id
        WHERE fr.requester_id = ? AND fr.target_id = ?`).bind(targetId, viewer.id).first<{ status: string; username: string }>();
      if (!requestRow || requestRow.status !== "pending") return NextResponse.json({ error: "This follow request is no longer pending." }, { status: 409 });
      const approved = input.decision === "approve";
      const notification = DB.prepare("INSERT INTO notifications (id, user_id, actor_id, type, entity_id, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), targetId, viewer.id, approved ? "follow_request_approved" : "follow_request_declined", viewer.id, `@${viewer.username} ${approved ? "approved" : "declined"} your follow request.`, now);
      const updates = [
        DB.prepare("UPDATE follow_requests SET status = ?, responded_at = ? WHERE requester_id = ? AND target_id = ? AND status = 'pending'").bind(approved ? "approved" : "declined", now, targetId, viewer.id),
        notification,
      ];
      if (approved) updates.unshift(DB.prepare("INSERT OR IGNORE INTO follows (follower_id, followed_id, created_at) VALUES (?, ?, ?)").bind(targetId, viewer.id, now));
      await DB.batch(updates);
      return NextResponse.json({ approved, counts: await connectionCounts(DB, viewer.id) });
    }
    if (input.action === "block") {
      if (!targetId || targetId === viewer.id) return NextResponse.json({ error: "Choose another profile." }, { status: 400 });
      const exists = await DB.prepare("SELECT 1 AS active FROM blocks WHERE blocker_id = ? AND blocked_id = ?").bind(viewer.id, targetId).first();
      if (exists) await DB.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?").bind(viewer.id, targetId).run();
      else await DB.batch([
        DB.prepare("INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)").bind(viewer.id, targetId, now),
        DB.prepare("DELETE FROM follows WHERE (follower_id = ? AND followed_id = ?) OR (follower_id = ? AND followed_id = ?)").bind(viewer.id, targetId, targetId, viewer.id),
        DB.prepare("DELETE FROM follow_requests WHERE (requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)").bind(viewer.id, targetId, targetId, viewer.id),
      ]);
      return NextResponse.json({ blocked: !exists, counts: await connectionCounts(DB, viewer.id) });
    }
    if (input.action === "report") {
      if (!targetId || !["post", "profile"].includes(input.targetType || "")) return NextResponse.json({ error: "Choose something to report." }, { status: 400 });
      const reason = String(input.reason || "").trim().slice(0, 500);
      if (reason.length < 5) return NextResponse.json({ error: "Tell the administrator what happened." }, { status: 400 });
      await DB.prepare("INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)")
        .bind(crypto.randomUUID(), viewer.id, input.targetType, targetId, reason, now).run();
      return NextResponse.json({ reported: true }, { status: 201 });
    }
    if (input.action === "read-notifications") {
      await DB.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").bind(now, viewer.id).run();
      return NextResponse.json({ read: true });
    }
    if (viewer.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    if (input.action === "create-invite") {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(8))).map((value) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[value % 32]).join("");
      await DB.prepare("INSERT INTO invites (code, created_by, created_at) VALUES (?, ?, ?)").bind(code, viewer.id, now).run();
      return NextResponse.json({ code }, { status: 201 });
    }
    if (input.action === "revoke-invite" || input.action === "reactivate-invite") {
      const code = String(input.code || "").trim().toUpperCase();
      const invite = await DB.prepare("SELECT claimed_by AS claimedBy, revoked FROM invites WHERE code = ?").bind(code).first<{ claimedBy: string | null; revoked: number }>();
      if (!invite) return NextResponse.json({ error: "Invite code not found." }, { status: 404 });
      if (invite.claimedBy) return NextResponse.json({ error: "A claimed invite cannot be changed." }, { status: 409 });
      const revoked = input.action === "revoke-invite" ? 1 : 0;
      await DB.prepare("UPDATE invites SET revoked = ? WHERE code = ? AND claimed_by IS NULL").bind(revoked, code).run();
      return NextResponse.json({ code, revoked: Boolean(revoked) });
    }
    if (input.action === "registration-mode") {
      const mode = input.mode === "open" ? "open" : "invite";
      await DB.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('registration_mode', ?)").bind(mode).run();
      return NextResponse.json({ registrationMode: mode });
    }
    if (input.action === "suspend") {
      const target = await DB.prepare("SELECT role, status FROM users WHERE id = ?").bind(targetId).first<{ role: string; status: string }>();
      if (!target || target.role === "admin") return NextResponse.json({ error: "This account cannot be suspended." }, { status: 400 });
      const status = target.status === "active" ? "suspended" : "active";
      await DB.prepare("UPDATE users SET status = ? WHERE id = ?").bind(status, targetId).run();
      return NextResponse.json({ status });
    }
    if (input.action === "resolve-report") {
      await DB.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").bind(input.reportId || "").run();
      return NextResponse.json({ resolved: true });
    }
    return NextResponse.json({ error: "Unknown social action." }, { status: 400 });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not complete this action." }, { status: 500 }); }
}
