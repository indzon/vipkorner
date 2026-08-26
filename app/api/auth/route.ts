import { NextResponse } from "next/server";
import { bindings, ensureSchema } from "@/db/storage";
import { finalizePendingRegistration, normalizeUsername, verifyAdultBirthDate } from "@/lib/registration";
import { supabaseConfigured, supabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  if (!supabaseConfigured()) return NextResponse.redirect(new URL("/login", request.url));
  const client = await supabaseServerClient();
  await client?.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "Public authentication is not configured yet." }, { status: 503 });
  const input = await request.json() as {
    action?: string;
    email?: string;
    password?: string;
    displayName?: string;
    username?: string;
    inviteCode?: string;
    birthDate?: string;
  };
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
    const displayName = String(input.displayName || "").trim().slice(0, 50);
    const username = normalizeUsername(input.username);
    if (!displayName) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    if (username.length < 3) return NextResponse.json({ error: "Choose a username with at least 3 letters, numbers, dots, or underscores." }, { status: 400 });
    let adultConfirmedAt: number;
    try {
      adultConfirmedAt = verifyAdultBirthDate(input.birthDate);
    } catch (reason) {
      return NextResponse.json({ error: reason instanceof Error ? reason.message : "Enter a valid date of birth." }, { status: 400 });
    }

    const now = Date.now();
    await DB.prepare("DELETE FROM pending_registrations WHERE created_at < ?").bind(now - 48 * 60 * 60 * 1000).run();
    const existing = await DB.prepare("SELECT id FROM users WHERE email = ? OR lower(username) = lower(?)")
      .bind(email, username).first<{ id: string }>();
    if (existing) return NextResponse.json({ error: "That email or username is already registered." }, { status: 409 });
    await DB.prepare("DELETE FROM pending_registrations WHERE email = ?").bind(email).run();
    const pendingUsername = await DB.prepare("SELECT auth_user_id FROM pending_registrations WHERE lower(username) = lower(?)")
      .bind(username).first();
    if (pendingUsername) return NextResponse.json({ error: "That username is already reserved." }, { status: 409 });

    const count = await DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
    const mode = await DB.prepare("SELECT value FROM app_meta WHERE key = 'registration_mode'").first<{ value: string }>();
    const inviteRequired = Boolean(count?.total) && mode?.value !== "open";
    const inviteCode = String(input.inviteCode || "").trim().toUpperCase();
    if (inviteRequired) {
      const invite = await DB.prepare(`SELECT invites.code FROM invites
        LEFT JOIN pending_registrations ON pending_registrations.invite_code = invites.code
        WHERE invites.code = ? AND invites.claimed_by IS NULL AND invites.revoked = 0
          AND pending_registrations.auth_user_id IS NULL`).bind(inviteCode).first<{ code: string }>();
      if (!invite) return NextResponse.json({ error: "Enter a valid, active, unused invite code." }, { status: 403 });
    }
    const reservationId = `pending:${crypto.randomUUID()}`;
    try {
      await DB.prepare(`INSERT INTO pending_registrations (
        auth_user_id, email, username, display_name, invite_code, adult_confirmed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(
        reservationId, email, username, displayName, inviteRequired ? inviteCode : null, adultConfirmedAt, now,
      ).run();
    } catch {
      return NextResponse.json({ error: "That email, username, or invitation is already reserved." }, { status: 409 });
    }

    const origin = "https://vipkorner.app";
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          username,
          invite_code: inviteRequired ? inviteCode : "",
        },
        emailRedirectTo: `${origin}/auth/confirm`,
      },
    });
    if (error || !data.user?.id) {
      await DB.prepare("DELETE FROM pending_registrations WHERE auth_user_id = ?").bind(reservationId).run();
      return NextResponse.json({ error: error?.message || "Could not create the authentication account." }, { status: 400 });
    }
    await DB.prepare("UPDATE pending_registrations SET auth_user_id = ? WHERE auth_user_id = ?")
      .bind(data.user.id, reservationId).run();
    if (data.session && data.user.email) {
      try {
        await finalizePendingRegistration(data.user.id, data.user.email);
      } catch (reason) {
        await client.auth.signOut();
        return NextResponse.json({ error: reason instanceof Error ? reason.message : "Could not finish creating your VipKorner profile." }, { status: 409 });
      }
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
