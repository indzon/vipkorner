"use client";

import { ArrowRight, Check, LockKeyhole, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type SessionState = {
  authenticated: boolean;
  authProvider?: "supabase" | "chatgpt";
  signInPath?: string;
  signOutPath?: string;
  identity?: { displayName: string };
  user?: { username: string; status: string } | null;
  bootstrapRequired?: boolean;
  inviteRequired?: boolean;
};

export default function LoginPage() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [adult, setAdult] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [authAction, setAuthAction] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/session").then(async (response) => {
      const data = await response.json() as SessionState;
      setSession(data);
      setDisplayName(data.identity?.displayName || "");
      if (data.user?.status === "active") location.replace("/");
    }).catch(() => setError("VipKorner could not verify this session. Try refreshing."));
  }, []);

  async function authenticate(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setAuthNotice("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: authAction, email, password, displayName }) });
      const data = await response.json() as { error?: string; confirmationRequired?: boolean };
      if (!response.ok) throw new Error(data.error || "Could not authenticate.");
      if (data.confirmationRequired) { setAuthNotice("Check your email to confirm your account, then return here to sign in."); setBusy(false); return; }
      location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not authenticate."); setBusy(false); }
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, displayName, inviteCode, adult }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create your account.");
      localStorage.setItem("vipkorner-adult-access", String(Date.now()));
      location.href = "/";
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create your account."); setBusy(false); }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="About VipKorner">
        <a className="login-brand" href="/login"><span className="brand-mark">V</span><span>VipKorner</span></a>
        <div className="login-story-copy"><span className="login-kicker"><Sparkles /> REAL PEOPLE, REAL MOMENTS</span><h1>Share what feels<br />like you.</h1><p>Public profiles, photo and video posts, 24-hour stories, and private text conversations in one installable social app.</p></div>
        <div className="login-promise"><ShieldCheck /><div><strong>Invite-only beta</strong><span>New accounts need an invite while the community gets established.</span></div></div>
      </section>

      <section className="login-panel">
        {!session ? <div className="login-card login-loading"><span className="login-lock"><LockKeyhole /></span><h2>Checking access…</h2></div> : !session.authenticated && session.authProvider === "supabase" ? (
          <form className="login-card" onSubmit={authenticate}>
            <span className="login-lock"><LockKeyhole /></span><span className="eyebrow">WELCOME TO VIPKORNER</span><h2>{authAction === "sign-in" ? "Sign in securely" : "Create your login"}</h2>
            <p className="login-subtitle">{authAction === "sign-in" ? "Use your email and password to continue." : "Create a secure login first. You’ll choose your public profile and enter an invite code next."}</p>
            {authAction === "sign-up" && <label className="login-field"><span>Name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={50} required /></label>}
            <label className="login-field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label className="login-field"><span>Password</span><input type="password" autoComplete={authAction === "sign-in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <div className="age-disclaimer" role="note"><strong>Adults only — 18+</strong><p>Anyone under 18 is prohibited from accessing, registering for, or using VipKorner.</p></div>
            {authAction === "sign-up" && <label className="age-confirmation"><input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} /><span><Check /></span><p>I confirm that I am at least 18 years old and agree to the adults-only access policy.</p></label>}
            {authNotice && <p className="panel-notice" role="status">{authNotice}</p>}
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" disabled={busy || (authAction === "sign-up" && !adult)}>{busy ? "Please wait…" : authAction === "sign-in" ? "Sign in" : "Create login"} <ArrowRight /></button>
            <button className="login-auth-switch" type="button" onClick={() => { setAuthAction((current) => current === "sign-in" ? "sign-up" : "sign-in"); setError(""); setAuthNotice(""); }}>{authAction === "sign-in" ? "New to VipKorner? Create a login" : "Already have a login? Sign in"}</button>
            <small className="login-footnote">VipKorner never stores your password in its application database.</small>
          </form>
        ) : !session.authenticated ? (
          <div className="login-card">
            <span className="login-lock"><LockKeyhole /></span><span className="eyebrow">WELCOME TO VIPKORNER</span><h2>Sign in securely</h2>
            <p className="login-subtitle">Use your ChatGPT identity to access VipKorner during the hosting transition. Your VipKorner username and profile stay separate.</p>
            <div className="age-disclaimer" role="note"><strong>Adults only — 18+</strong><p>Anyone under 18 is prohibited from accessing, registering for, or using VipKorner.</p></div>
            <a className="login-submit" href={session.signInPath || "/signin-with-chatgpt?return_to=%2Flogin"}>Sign in with ChatGPT <ArrowRight /></a>
            <small className="login-footnote">Authentication is handled securely by ChatGPT. VipKorner does not store a password.</small>
          </div>
        ) : session.user?.status === "suspended" ? (
          <div className="login-card"><span className="login-lock"><LockKeyhole /></span><h2>Account suspended</h2><p className="login-subtitle">This VipKorner account is unavailable. Contact the administrator if you believe this is a mistake.</p><a className="login-submit" href={session.signOutPath}>Sign out</a></div>
        ) : (
          <form className="login-card" onSubmit={createAccount}>
            <span className="login-lock"><UserPlus /></span><span className="eyebrow">{session.bootstrapRequired ? "ADMIN SETUP" : "CREATE YOUR PROFILE"}</span>
            <h2>{session.bootstrapRequired ? "Claim the original account" : "Join VipKorner"}</h2>
            <p className="login-subtitle">{session.bootstrapRequired ? "You’ll become the first administrator. The existing profile name, username, posts, stories, and media will be preserved." : "Choose the public identity people will see."}</p>
            {!session.bootstrapRequired && <><label className="login-field"><span>Name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={50} required /></label><label className="login-field"><span>Username</span><div className="input-prefix"><i>@</i><input value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))} minLength={3} maxLength={30} required /></div></label></>}
            {!session.bootstrapRequired && session.inviteRequired && <label className="login-field"><span>Invite code</span><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} required /></label>}
            <div className="age-disclaimer" role="note"><strong>Adults only — 18+</strong><p>VipKorner is strictly for adults age 18 and older.</p></div>
            <label className="age-confirmation"><input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} /><span><Check /></span><p>I confirm that I am at least 18 years old and agree to the adults-only access policy.</p></label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" disabled={busy || !adult}>{busy ? "Creating account…" : session.bootstrapRequired ? "Claim admin account" : "Create account"} <ArrowRight /></button>
          </form>
        )}
      </section>
    </main>
  );
}
