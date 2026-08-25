import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const loginUrl = new URL("/login", requestUrl.origin);
  const code = requestUrl.searchParams.get("code");

  if (!supabaseConfigured() || !code) {
    loginUrl.searchParams.set("confirmation_error", "1");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const client = await supabaseServerClient();
    const { error } = client
      ? await client.auth.exchangeCodeForSession(code)
      : { error: new Error("Supabase is unavailable") };

    loginUrl.searchParams.set(error ? "confirmation_error" : "confirmed", "1");
    return NextResponse.redirect(loginUrl);
  } catch {
    loginUrl.searchParams.set("confirmation_error", "1");
    return NextResponse.redirect(loginUrl);
  }
}
