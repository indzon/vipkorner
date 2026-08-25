import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { authErrorResponse, blockedBetween, requireUser } from "@/lib/current-user";

function orderedPair(first: string, second: string) { return first < second ? [first, second] : [second, first]; }

export async function GET(request: Request) {
  try {
    await ensureSchema(); const user = await requireUser(); const { DB } = bindings();
    const conversationId = new URL(request.url).searchParams.get("conversationId");
    if (conversationId) {
      const conversation = await DB.prepare("SELECT * FROM conversations WHERE id = ? AND (user_a = ? OR user_b = ?)").bind(conversationId, user.id, user.id).first<Record<string, unknown>>();
      if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      const messages = await DB.prepare(`SELECT m.id, m.sender_id AS senderId, m.body, m.created_at AS createdAt, m.read_at AS readAt,
        u.username, u.image_key AS imageKey, u.image_url AS imageUrl FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = ? ORDER BY m.created_at ASC LIMIT 300`).bind(conversationId).all();
      await DB.prepare("UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL").bind(Date.now(), conversationId, user.id).run();
      return NextResponse.json({ conversation, messages: messages.results });
    }
    const conversations = await DB.prepare(`SELECT c.id, c.status, c.requested_by AS requestedBy, c.updated_at AS updatedAt,
      u.id AS otherId, u.username, u.display_name AS displayName, u.image_key AS imageKey, u.image_url AS imageUrl,
      (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS lastMessage,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.read_at IS NULL) AS unread
      FROM conversations c JOIN users u ON u.id = CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END
      WHERE (c.user_a = ? OR c.user_b = ?) AND u.status = 'active'
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?))
      ORDER BY c.updated_at DESC`).bind(user.id, user.id, user.id, user.id, user.id, user.id).all();
    return NextResponse.json({ conversations: conversations.results });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not load messages." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    await ensureSchema(); const user = await requireUser(); const { DB } = bindings();
    const input = await request.json() as { action?: "start" | "send" | "accept" | "decline"; targetId?: string; conversationId?: string; body?: string };
    const now = Date.now();
    if (input.action === "start") {
      const targetId = String(input.targetId || "");
      if (!targetId || targetId === user.id || await blockedBetween(user.id, targetId)) return NextResponse.json({ error: "Messaging is unavailable for this profile." }, { status: 403 });
      const target = await DB.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").bind(targetId).first();
      if (!target) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
      const [userA, userB] = orderedPair(user.id, targetId);
      let conversation = await DB.prepare("SELECT id, status FROM conversations WHERE user_a = ? AND user_b = ?").bind(userA, userB).first<{ id: string; status: string }>();
      if (!conversation) {
        const recipientFollows = await DB.prepare("SELECT 1 AS yes FROM follows WHERE follower_id = ? AND followed_id = ?").bind(targetId, user.id).first();
        const id = crypto.randomUUID(); const status = recipientFollows ? "accepted" : "pending";
        await DB.prepare("INSERT INTO conversations (id, user_a, user_b, requested_by, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(id, userA, userB, user.id, status, now, now).run();
        conversation = { id, status };
      }
      return NextResponse.json(conversation, { status: 201 });
    }

    const conversation = await DB.prepare("SELECT id, user_a AS userA, user_b AS userB, requested_by AS requestedBy, status FROM conversations WHERE id = ? AND (user_a = ? OR user_b = ?)")
      .bind(input.conversationId || "", user.id, user.id).first<{ id: string; userA: string; userB: string; requestedBy: string; status: string }>();
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const otherId = conversation.userA === user.id ? conversation.userB : conversation.userA;
    if (await blockedBetween(user.id, otherId)) return NextResponse.json({ error: "Messaging is unavailable for this profile." }, { status: 403 });
    if (input.action === "accept") {
      if (conversation.requestedBy === user.id) return NextResponse.json({ error: "Only the recipient can accept this request." }, { status: 403 });
      await DB.prepare("UPDATE conversations SET status = 'accepted', updated_at = ? WHERE id = ?").bind(now, conversation.id).run();
      return NextResponse.json({ status: "accepted" });
    }
    if (input.action === "decline") {
      if (conversation.requestedBy === user.id) return NextResponse.json({ error: "Only the recipient can decline this request." }, { status: 403 });
      await DB.batch([DB.prepare("DELETE FROM messages WHERE conversation_id = ?").bind(conversation.id), DB.prepare("DELETE FROM conversations WHERE id = ?").bind(conversation.id)]);
      return NextResponse.json({ declined: true });
    }
    if (input.action === "send") {
      const body = String(input.body || "").trim().slice(0, 2000);
      if (!body) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
      if (conversation.status === "pending" && conversation.requestedBy !== user.id) return NextResponse.json({ error: "Accept this message request before replying." }, { status: 403 });
      const id = crypto.randomUUID();
      await DB.batch([
        DB.prepare("INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, conversation.id, user.id, body, now),
        DB.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").bind(now, conversation.id),
        DB.prepare("INSERT INTO notifications (id, user_id, actor_id, type, entity_id, message, created_at) VALUES (?, ?, ?, 'message', ?, ?, ?)")
          .bind(crypto.randomUUID(), otherId, user.id, conversation.id, `@${user.username} sent you a message.`, now),
      ]);
      return NextResponse.json({ id, conversationId: conversation.id, senderId: user.id, body, createdAt: now }, { status: 201 });
    }
    return NextResponse.json({ error: "Unknown message action." }, { status: 400 });
  } catch (error) { return authErrorResponse(error) || NextResponse.json({ error: "Could not complete this message action." }, { status: 500 }); }
}
