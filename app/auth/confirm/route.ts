import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { finalizePendingRegistration } from "@/lib/registration";
import { supabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const client = await supabaseServerClient();

  if (client && code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (!error && data.user?.email) {
      try {
        await finalizePendingRegistration(data.user.id, data.user.email);
        return NextResponse.redirect(new URL("/", requestUrl.origin));
      } catch (reason) {
        console.error("Could not finalize confirmed VipKorner account", reason);
      }
    }
  }

  if (client && tokenHash && type) {
    const { data, error } = await client.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user?.email) {
      try {
        await finalizePendingRegistration(data.user.id, data.user.email);
        return NextResponse.redirect(new URL("/", requestUrl.origin));
      } catch (reason) {
        console.error("Could not finalize confirmed VipKorner account", reason);
      }
    }
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("confirmation", "failed");
  return NextResponse.redirect(loginUrl);
}
