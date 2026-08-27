"use client";

import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type SessionState = {
  authenticated: boolean;
  signInPath?: string;
  signOutPath?: string;
  identity?: { displayName: string; inviteCode?: string };
  user?: { username: string; status: string } | null;
  bootstrapRequired?: boolean;
  inviteRequired?: boolean;
};

export default function LoginPage() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [birthDate, setBirthDate] = useState("");
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
      setInviteCode(data.identity?.inviteCode || "");
      if (data.user?.status === "active") location.replace("/");
    }).catch(() => setError("VipKorner could not verify this session. Try refreshing."));
  }, []);

  async function authenticate(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setAuthNotice("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: authAction, email, password, displayName, username, inviteCode, birthDate }) });
      const data = await response.json() as { error?: string; confirmationRequired?: boolean };
      if (!response.ok) throw new Error(data.error || "Could not authenticate.");
      if (data.confirmationRequired) { setAuthNotice("Check your email. After you confirm, you’ll be signed in and taken directly to VipKorner."); setBusy(false); return; }
      location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not authenticate."); setBusy(false); }
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, displayName, inviteCode, birthDate }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create your account.");
      location.href = "/";
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create your account."); setBusy(false); }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="About VipKorner">
        <a className="login-brand" href="/login"><span className="brand-mark">V</span><span>VipKorner</span></a>
        <div className="login-story-copy"><span className="login-kicker"><Sparkles /> REAL PEOPLE, REAL MOMENTS</span><h1>Share what feels<br />like you.</h1><p>Public profiles, photo and video posts, 24-hour shorts, and private text conversations in one installable social app.</p></div>
        <div className="login-promise"><ShieldCheck /><div><strong>Invite-only beta</strong><span>New accounts need an invite while the community gets established.</span></div></div>
      </section>

      <section className="login-panel">
        {!session ? <div className="login-card login-loading"><span className="login-lock"><LockKeyhole /></span><h2>Checking access…</h2></div> : !session.authenticated ? (
          <form className="login-card" onSubmit={authenticate}>
            <span className="login-lock"><LockKeyhole /></span><span className="eyebrow">WELCOME TO VIPKORNER</span><h2>{authAction === "sign-in" ? "Sign in" : "Create your account"}</h2>
            <p className="login-subtitle">{authAction === "sign-in" ? "Enter your email and password to continue." : "Enter your email and active invitation code to join VipKorner."}</p>
            {authAction === "sign-up" && <><label className="login-field"><span>Name</span><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={50} required /></label><label className="login-field"><span>Username</span><div className="input-prefix"><i>@</i><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))} minLength={3} maxLength={30} required /></div></label></>}
            <label className="login-field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            {authAction === "sign-up" && session.inviteRequired && <label className="login-field"><span>Invite code</span><input autoComplete="one-time-code" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={32} required /></label>}
            <label className="login-field"><span>Password</span><input type="password" autoComplete={authAction === "sign-in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {authAction === "sign-up" && <label className="login-field"><span>Date of birth</span><input type="date" autoComplete="bday" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required /><small>Used only to verify eligibility. Your birth date is not stored.</small></label>}
            {authNotice && <p className="panel-notice" role="status">{authNotice}</p>}
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" disabled={busy || (authAction === "sign-up" && (!displayName.trim() || username.length < 3 || !birthDate || (session.inviteRequired && !inviteCode.trim())))}>{busy ? "Please wait…" : authAction === "sign-in" ? "Sign in" : "Create account"} <ArrowRight /></button>
            <button className="login-auth-switch" type="button" onClick={() => { setAuthAction((current) => current === "sign-in" ? "sign-up" : "sign-in"); setError(""); setAuthNotice(""); }}>{authAction === "sign-in" ? "Have an invitation? Create an account" : "Already a member? Sign in"}</button>
            <small className="login-footnote">VipKorner never stores your password in its application database.</small>
          </form>
        ) : session.user?.status === "suspended" ? (
          <div className="login-card"><span className="login-lock"><LockKeyhole /></span><h2>Account suspended</h2><p className="login-subtitle">This VipKorner account is unavailable. Contact the administrator if you believe this is a mistake.</p><a className="login-submit" href={session.signOutPath}>Sign out</a></div>
        ) : (
          <form className="login-card" onSubmit={createAccount}>
            <span className="login-lock"><UserPlus /></span><span className="eyebrow">{session.bootstrapRequired ? "ADMIN SETUP" : "CREATE YOUR PROFILE"}</span>
            <h2>{session.bootstrapRequired ? "Claim the original account" : "Join VipKorner"}</h2>
            <p className="login-subtitle">{session.bootstrapRequired ? "You’ll become the first administrator. The existing profile name, username, posts, shorts, and media will be preserved." : "Choose the public identity people will see."}</p>
            <><label className="login-field"><span>Name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={50} required /></label><label className="login-field"><span>Username</span><div className="input-prefix"><i>@</i><input value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))} minLength={3} maxLength={30} required /></div></label></>
            {!session.bootstrapRequired && session.inviteRequired && <label className="login-field"><span>Invite code</span><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} required /></label>}
            <label className="login-field"><span>Date of birth</span><input type="date" autoComplete="bday" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required /><small>Used only to verify eligibility. Your birth date is not stored.</small></label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" disabled={busy || !displayName.trim() || username.length < 3 || !birthDate}>{busy ? "Creating account…" : session.bootstrapRequired ? "Claim admin account" : "Create account"} <ArrowRight /></button>
          </form>
        )}
      </section>
    </main>
  );
}
