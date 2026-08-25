import { NextResponse } from "next/server";
import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { supabaseConfigured, supabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  if (!supabaseConfigured()) return NextResponse.redirect(new URL(chatGPTSignOutPath("/login"), request.url));
  const client = await supabaseServerClient();
  await client?.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "Public authentication is not configured yet." }, { status: 503 });
  const input = await request.json() as { action?: string; email?: string; password?: string; displayName?: string };
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
    const origin = new URL(request.url).origin;
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: String(input.displayName || "").trim().slice(0, 50) }, emailRedirectTo: `${origin}/login` },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ authenticated: Boolean(data.session), confirmationRequired: !data.session });
  }

  if (input.action === "sign-in") {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ error: "Unknown authentication action." }, { status: 400 });
}
