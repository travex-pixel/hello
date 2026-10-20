"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { describeError, peopleApi } from "./api";

/** Email, then a six-digit code. No passwords to forget. */
export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await peopleApi.sendCode(email.trim());
      setStep("code");
      setNotice(`We sent a code to ${email.trim()}. It can take a minute, and it may land in spam.`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await peopleApi.verifyCode(email.trim(), code);
      onSignedIn();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const input =
    "mt-1.5 h-12 w-full rounded-md border border-line-strong bg-bg px-4 text-[15px] text-ink placeholder:text-ink-3 focus:border-cobalt";

  return (
    <section className="rounded-xl bg-surface p-4 shadow-card">
      <h2 className="display text-[22px] text-ink">{step === "email" ? "Sign in" : "Enter your code"}</h2>
      {step === "email" ? (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <p className="text-sm leading-relaxed text-ink-2">We&rsquo;ll email you a six-digit code. Your email is only used to sign you in, and other members never see it.</p>
          <label className="block text-sm font-medium text-ink">
            Email
            <input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} />
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block loading={busy} disabled={!email.trim()}>
            Email me a code
          </Button>
        </form>
      ) : (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          {notice && <p className="text-sm leading-relaxed text-ink-2">{notice}</p>}
          <label className="block text-sm font-medium text-ink">
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={12}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="123456"
              className={`${input} font-mono tracking-[0.3em]`}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block loading={busy} disabled={code.length < 6}>
            Sign in
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-ink-2 underline-offset-4 hover:underline" onClick={() => setStep("email")}>
              Use a different email
            </button>
            <button type="button" className="text-ink-2 underline-offset-4 hover:underline" onClick={() => void send()} disabled={busy}>
              Send a new code
            </button>
          </div>
        </form>
      )}
      <p className="mt-3 text-xs text-ink-3">
        Private beta.{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          How we handle your data
        </Link>
      </p>
    </section>
  );
}
