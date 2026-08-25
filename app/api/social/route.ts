import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { authErrorResponse, blockedBetween, requireUser } from "@/lib/current-user";

export async function GET(request: Request) {
  try {
    await ensureSchema(); const viewer = await requireUser(); const { DB } = bindings();
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 60) || "";
    const users = await DB.prepare(`SELECT u.id, u.username, u.display_name AS displayName, u.bio, u.location,
      u.image_key AS imageKey, u.image_url AS imageUrl, u.role, u.is_public AS isPublic,
      EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followed_id = u.id) AS following,
      EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followed_id = ?) AS followsYou,
      (SELECT COUNT(*) FROM follows f WHERE f.followed_id = u.id) AS followers,
      (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS posts,
      EXISTS(SELECT 1 FROM blocks b WHERE b.blocker_id = ? AND b.blocked_id = u.id) AS blocked
      FROM users u WHERE u.id != ? AND u.status = 'active'
      AND (u.is_public = 1 OR EXISTS(SELECT 1 FROM follows visible WHERE visible.follower_id = ? AND visible.followed_id = u.id))
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.blocker_id = u.id AND b.blocked_id = ?)
      AND (? = '' OR lower(u.username) LIKE lower(?) OR lower(u.display_name) LIKE lower(?))
      ORDER BY followers DESC, u.created_at DESC LIMIT 40`)
      .bind(viewer.id, viewer.id, viewer.id, viewer.id, viewer.id, viewer.id, query, `%${query}%`, `%${query}%`).all();
    const unread = await DB.prepare("SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL").bind(viewer.id).first<{ total: number }>();
    const admin = viewer.role === "admin" ? {
      invites: (await DB.prepare(`SELECT i.code, i.created_at AS createdAt, i.claimed_at AS claimedAt, i.revoked,
        u.username AS claimedUsername FROM invites i LEFT JOIN users u ON u.id = i.claimed_by ORDER BY i.created_at DESC LIMIT 50`).all()).results,
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
    const input = await request.json() as { action?: string; targetId?: string; targetType?: string; reason?: string; mode?: string; reportId?: string };
    const targetId = String(input.targetId || ""); const now = Date.now();
    if (input.action === "follow") {
      if (!targetId || targetId === viewer.id || await blockedBetween(viewer.id, targetId)) return NextResponse.json({ error: "This profile cannot be followed." }, { status: 403 });
      const exists = await DB.prepare("SELECT 1 AS active FROM follows WHERE follower_id = ? AND followed_id = ?").bind(viewer.id, targetId).first();
      if (exists) await DB.prepare("DELETE FROM follows WHERE follower_id = ? AND followed_id = ?").bind(viewer.id, targetId).run();
      else {
        await DB.prepare("INSERT INTO follows (follower_id, followed_id, created_at) VALUES (?, ?, ?)").bind(viewer.id, targetId, now).run();
        await DB.prepare("INSERT INTO notifications (id, user_id, actor_id, type, entity_id, message, created_at) VALUES (?, ?, ?, 'follow', ?, ?, ?)")
          .bind(crypto.randomUUID(), targetId, viewer.id, viewer.id, `@${viewer.username} followed you.`, now).run();
      }
      return NextResponse.json({ following: !exists });
    }
    if (input.action === "block") {
      if (!targetId || targetId === viewer.id) return NextResponse.json({ error: "Choose another profile." }, { status: 400 });
      const exists = await DB.prepare("SELECT 1 AS active FROM blocks WHERE blocker_id = ? AND blocked_id = ?").bind(viewer.id, targetId).first();
      if (exists) await DB.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?").bind(viewer.id, targetId).run();
      else await DB.batch([
        DB.prepare("INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)").bind(viewer.id, targetId, now),
        DB.prepare("DELETE FROM follows WHERE (follower_id = ? AND followed_id = ?) OR (follower_id = ? AND followed_id = ?)").bind(viewer.id, targetId, targetId, viewer.id),
      ]);
      return NextResponse.json({ blocked: !exists });
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
