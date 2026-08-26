import { NextResponse } from "next/server";
import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { bindings, ensureSchema } from "@/db/storage";
import { supabaseConfigured, supabaseServerClient } from "@/lib/supabase-server";

const INVITE_RESERVATION_MS = 48 * 60 * 60 * 1000;

function confirmationUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || "https://vipkorner.vipkorner.workers.dev";
  return new URL("/auth/confirm", configured).toString();
}

export async function GET(request: Request) {
  if (!supabaseConfigured()) return NextResponse.redirect(new URL(chatGPTSignOutPath("/login"), request.url));
  const client = await supabaseServerClient();
  await client?.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "Public authentication is not configured yet." }, { status: 503 });
  const input = await request.json() as { action?: string; email?: string; password?: string; displayName?: string; inviteCode?: string; adult?: boolean };
  const client = await supabaseServerClient();
  if (!client) return NextResponse.json({ error: "Public authentication is unavailable." }, { status: 503 });

  if (input.action === "sign-out") {
    await client.auth.signOut();
    return NextResponse.json({ signedOut: true });
  }

  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  if (!email || password.length < 8) return NextResponse.json({ error: "Enter a valid email and a password with at least 8 characters." }, { status: 400 });

  if (input.action === "sign-up") {
    await ensureSchema();
    const { DB } = bindings();
    const count = await DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
    const inviteRequired = Boolean(count?.total);
    const inviteCode = String(input.inviteCode || "").trim().toUpperCase();
    let inviteReserved = false;

    if (!input.adult) return NextResponse.json({ error: "You must confirm that you are at least 18 years old." }, { status: 400 });
    if (inviteRequired) {
      const now = Date.now();
      await DB.prepare(`UPDATE invites SET reserved_email = NULL, reserved_at = NULL
        WHERE claimed_by IS NULL AND reserved_at IS NOT NULL AND reserved_at < ?`).bind(now - INVITE_RESERVATION_MS).run();
      const reservation = await DB.prepare(`UPDATE invites SET reserved_email = ?, reserved_at = ?
        WHERE code = ? AND claimed_by IS NULL AND revoked = 0
        AND (reserved_email IS NULL OR lower(reserved_email) = lower(?))`)
        .bind(email, now, inviteCode, email).run();
      const changed = Number((reservation.meta as { changes?: number } | undefined)?.changes || 0);
      if (!inviteCode || !reservation.success || changed !== 1) {
        return NextResponse.json({ error: "Enter a valid, active, unused invite code." }, { status: 403 });
      }
      inviteReserved = true;
    }

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: String(input.displayName || "").trim().slice(0, 50) },
        emailRedirectTo: confirmationUrl(),
      },
    });
    if (error) {
      if (inviteReserved) {
        await DB.prepare(`UPDATE invites SET reserved_email = NULL, reserved_at = NULL
          WHERE code = ? AND lower(reserved_email) = lower(?) AND claimed_by IS NULL`).bind(inviteCode, email).run();
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ authenticated: Boolean(data.session), confirmationRequired: !data.session });
  }

  if (input.action === "sign-in") {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ error: "Unknown authentication action." }, { status: 400 });
}
