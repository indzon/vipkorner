"use client";

import { ArrowRight, Check, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

export default function LoginPage() {
  const [adult, setAdult] = useState(false);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    const confirmedAt = Number(localStorage.getItem("estagram-adult-access") || 0);
    if (confirmedAt > 0 && Date.now() - confirmedAt < 30 * 24 * 60 * 60 * 1000) location.replace("/");
  }, []);

  function enter(event: FormEvent) {
    event.preventDefault();
    if (!adult) { setNotice(true); return; }
    localStorage.setItem("estagram-adult-access", String(Date.now()));
    location.href = "/";
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="About Estagram">
        <a className="login-brand" href="/login"><span className="brand-mark">e</span><span>estagram</span></a>
        <div className="login-story-copy"><span className="login-kicker"><Sparkles /> YOUR PRIVATE CREATIVE SPACE</span><h1>Keep the moments<br />that feel like you.</h1><p>Photos, videos, captions, and 24-hour stories — gathered in one quiet place that belongs to you.</p></div>
        <div className="login-promise"><ShieldCheck /><div><strong>Private by design</strong><span>Your Estagram is available only through your authenticated private site.</span></div></div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={enter}>
          <span className="login-lock"><LockKeyhole /></span>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to Estagram</h2>
          <p className="login-subtitle">Continue to your single-user private account.</p>

          <div className="account-preview"><span className="account-avatar">E</span><div><strong>Account owner</strong><span>Authenticated private access</span></div><Check /></div>

          <div className="age-disclaimer" role="note"><strong>Adults only — 18+</strong><p>Estagram is strictly for adults age 18 and older. Anyone under 18 is prohibited from accessing, creating an account for, or using this app.</p></div>

          <label className={`age-confirmation ${notice && !adult ? "invalid" : ""}`}><input type="checkbox" checked={adult} onChange={(event) => { setAdult(event.target.checked); setNotice(false); }} /><span><Check /></span><p>I confirm that I am at least 18 years old and agree to follow Estagram&apos;s adults-only access policy.</p></label>
          {notice && !adult && <p className="login-error" role="alert">You must confirm that you are 18 or older to continue.</p>}

          <button className="login-submit" disabled={!adult}>Continue to Estagram <ArrowRight /></button>
          <small className="login-footnote">Age confirmation is remembered on this device for 30 days. Your private site authentication remains active separately.</small>
        </form>
      </section>
    </main>
  );
}
