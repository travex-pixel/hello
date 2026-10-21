"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, UsersRound } from "lucide-react";
import { PICKABLE_TOPICS, TOPIC_LABELS } from "@/lib/characters/topics";
import { MODE_COPY } from "@/lib/matching";
import { useHello } from "@/lib/conversation/store";
import { track } from "@/lib/analytics/track";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ModeSelector } from "@/components/discover/ModeSelector";
import { describeError, peopleApi, PeopleApiError, type MeView, type StatusView, type Suggestion } from "./api";
import { SignIn } from "./SignIn";

function Card({ title, children, tone = "default" }: { title?: string; children: React.ReactNode; tone?: "default" | "warning" }) {
  return (
    <section className={tone === "warning" ? "rounded-xl border border-warning/40 bg-warning/10 p-4" : "rounded-xl bg-surface p-4 shadow-card"}>
      {title && <h2 className="display text-[22px] text-ink">{title}</h2>}
      <div className={title ? "mt-3 flex flex-col gap-3" : "flex flex-col gap-3"}>{children}</div>
    </section>
  );
}



function HowItWillWork() {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
      <li>
        <strong className="text-ink">Invitation.</strong> A member sends you a code. Joining with it connects the two of you, nothing more.
      </li>
      <li>
        <strong className="text-ink">Start a conversation.</strong> Tap it on the home screen when you genuinely have time. You become visible to other members who are looking too, for up to 30 minutes.
      </li>
      <li>
        <strong className="text-ink">Both say yes.</strong> One person asks, the other accepts. No one is put into a chat without agreeing.
      </li>
      <li>
        <strong className="text-ink">Nobody free?</strong> You&rsquo;ll be told, and offered a chat with an AI character instead. It&rsquo;s your choice, and AI is always labelled.
      </li>
      <li>
        <strong className="text-ink">Your call, always.</strong> Leave, block or report at any time. Other members see your first name, never your email.
      </li>
    </ol>
  );
}

function DisabledView() {
  const router = useRouter();
  useEffect(() => {
    track("human_mode_unavailable_shown");
  }, []);
  return (
    <>
      <Card>
        <p className="text-sm leading-relaxed text-ink">
          Chatting with real people isn&rsquo;t switched on here yet, so nobody is available to meet. hello never puts an AI in a person&rsquo;s place: when there is no
          one, it says so.
        </p>
      </Card>
      <Card title="How it will work">
        <HowItWillWork />
        <p className="text-xs leading-relaxed text-ink-3">A shared connection is context, not a guarantee of safety or good behaviour.</p>
      </Card>
      <Card title="In the meantime">
        <p className="text-sm text-ink-2">The AI demo is here if you&rsquo;d like to try a conversation now. It&rsquo;s optional, and every partner is labelled as AI.</p>
        <Button variant="secondary" block onClick={() => router.push("/")}>
          Try the AI demo
        </Button>
      </Card>
    </>
  );
}

function JoinForm({ onJoined }: { onJoined: () => void }) {
  const [inviteCode, setInviteCode] = useState(() => (typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("invite") ?? "")));
  const [displayName, setDisplayName] = useState("");
  const [confirmAdult, setConfirmAdult] = useState(false);
  const [discoverable, setDiscoverable] = useState(true);
  const [shareAsMutual, setShareAsMutual] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await peopleApi.join({ inviteCode, displayName, confirmAdult, discoverable, shareAsMutual, disclosedInterests: interests });
      onJoined();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card title="Join with an invitation">
        <p className="text-sm leading-relaxed text-ink-2">
          Accepting an invitation connects you with the person who invited you. It doesn&rsquo;t start any conversation and doesn&rsquo;t share your connections with
          anyone.
        </p>

        <label className="block text-sm font-medium text-ink">
          Invite code
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="ABCD-EFGH"
            autoCapitalize="characters"
            className="mt-1.5 h-12 w-full rounded-md border border-line-strong bg-bg px-4 font-mono text-[15px] uppercase text-ink placeholder:text-ink-3 focus:border-cobalt"
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          Your name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={30}
            placeholder="First name or nickname"
            className="mt-1.5 h-12 w-full rounded-md border border-line-strong bg-bg px-4 text-[15px] text-ink placeholder:text-ink-3 focus:border-cobalt"
          />
        </label>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" checked={confirmAdult} onChange={(e) => setConfirmAdult(e.target.checked)} className="mt-1 size-4 accent-accent" />
          <span>I&rsquo;m 18 or over.</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" checked={discoverable} onChange={(e) => setDiscoverable(e.target.checked)} className="mt-1 size-4 accent-accent" />
          <span>
            Let other members find me when I&rsquo;m looking for a chat. <span className="text-ink-3">You can change this later.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" checked={shareAsMutual} onChange={(e) => setShareAsMutual(e.target.checked)} className="mt-1 size-4 accent-accent" />
          <span>
            Let two of my connections see &ldquo;You both know {displayName.trim() || "me"}&rdquo;. <span className="text-ink-3">Off means you&rsquo;re counted, not named.</span>
          </span>
        </label>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Interests to show people you meet (optional)</p>
          <div className="flex flex-wrap gap-2">
            {PICKABLE_TOPICS.map((t) => (
              <Chip key={t} selected={interests.includes(t)} onClick={() => setInterests((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]))}>
                {TOPIC_LABELS[t]}
              </Chip>
            ))}
          </div>
        </div>
        <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">
          This is a private beta. Your messages are stored so you and the other person can come back to them. Other members see your name, never your email.{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy notice
          </Link>
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button size="lg" block loading={busy} onClick={() => void submit()} disabled={!inviteCode.trim() || !displayName.trim()}>
          Join the beta
        </Button>
      </Card>
      <Card title="How it works">
        <HowItWillWork />
      </Card>
    </>
  );
}

function minutesLeft(expiresAt: number) {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000));
}

function Dashboard({ me, refresh }: { me: MeView; refresh: () => void }) {
  const router = useRouter();
  const mode = useHello((s) => s.mode);
  const setMode = useHello((s) => s.setMode);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [newInvite, setNewInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const available = !!me.availability;

  const loadSuggestions = useCallback(
    () =>
      peopleApi.discover(mode).then(
        (r) => setSuggestions(r.viewerAvailable ? r.suggestions : []),
        () => {
          /* keep the previous list */
        },
      ),
    [mode],
  );

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions, available, me.conversations.length]);

  // Other people switch availability on and off; keep the list fresh while we're available.
  useEffect(() => {
    if (!available) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadSuggestions();
    }, 3000);
    return () => window.clearInterval(t);
  }, [available, loadSuggestions]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      refresh();
      void loadSuggestions();
    } catch (e) {
      setNotice(describeError(e, "That didn't work. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const active = me.conversations.filter((c) => !c.endedAt);

  return (
    <>
      <Card title="I'm up for a chat">
        <ModeSelector value={mode} onChange={setMode} dense />
        {available ? (
          <>
            <p className="text-sm text-ink-2">
              You&rsquo;re visible to friends of friends for another {minutesLeft(me.availability!.expiresAt)} min, then it switches off by itself.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" block loading={busy === "extend"} onClick={() => void run("extend", () => peopleApi.setAvailability(true, mode))}>
                Extend
              </Button>
              <Button variant="ghost" block loading={busy === "off"} onClick={() => void run("off", () => peopleApi.setAvailability(false, mode))}>
                Turn off
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2">Switch this on when you genuinely have time to talk. Only people who have done the same can see you.</p>
            <Button size="lg" block loading={busy === "on"} onClick={() => void run("on", () => peopleApi.setAvailability(true, mode))}>
              I&rsquo;m up for a chat
            </Button>
          </>
        )}
      </Card>

      {notice && <p className="text-sm text-danger">{notice}</p>}

      {me.incoming.length > 0 && (
        <Card title="Someone would like to say hello">
          {me.incoming.map((r) => (
            <div key={r.id} className="rounded-md bg-surface-2 p-3">
              <p className="text-sm text-ink">
                <strong>{r.fromName}</strong> · {MODE_COPY[r.mode].label} · {minutesLeft(r.expiresAt)} min to answer
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  block
                  loading={busy === `accept-${r.id}`}
                  onClick={() =>
                    void run(`accept-${r.id}`, async () => {
                      const res = await peopleApi.answerRequest(r.id, "accept");
                      if (res.conversationId) router.push(`/people/chat/${res.conversationId}`);
                    })
                  }
                >
                  Accept
                </Button>
                <Button variant="ghost" block loading={busy === `decline-${r.id}`} onClick={() => void run(`decline-${r.id}`, () => peopleApi.answerRequest(r.id, "decline"))}>
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {active.length > 0 && (
        <Card title="Open conversations">
          {active.map((c) => (
            <Link key={c.id} href={`/people/chat/${c.id}`} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-3 text-sm text-ink hover:bg-surface-3">
              <span>
                <strong>{c.withName}</strong> · {MODE_COPY[c.mode].label}
              </span>
              <span className="text-ink-3">Open</span>
            </Link>
          ))}
        </Card>
      )}

      {available && (
        <Card title="People you could talk to">
          {suggestions.length === 0 ? (
            <>
              <p className="text-sm leading-relaxed text-ink-2">
                Nobody is available right now. Friends of friends who are also up for a chat will appear here. Nobody gets swapped in, and no AI is shown as a person.
              </p>
              <Button variant="secondary" block onClick={() => router.push("/")}>
                Try the AI demo instead
              </Button>
            </>
          ) : (
            suggestions.map((s) => {
              const pending = me.outgoing.find((o) => o.status === "pending" && o.toName === s.displayName);
              return (
                <div key={s.accountId} className="rounded-md bg-surface-2 p-3">
                  <p className="text-[15px] font-semibold text-ink">{s.displayName}</p>
                  <p className="text-sm text-ink-2">{s.pathContext}</p>
                  {s.sharedInterests.length > 0 && <p className="mt-1 text-xs text-ink-3">You both chose to share: {s.sharedInterests.map((t) => TOPIC_LABELS[t]).join(", ")}</p>}
                  <p className="mt-1 text-xs text-ink-3">Up for: {MODE_COPY[s.mode].label}</p>
                  {pending ? (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm text-ink-2">Waiting for {s.displayName}…</span>
                      <Button variant="ghost" size="sm" onClick={() => void run(`cancel-${pending.id}`, () => peopleApi.answerRequest(pending.id, "cancel"))}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button className="mt-2" block loading={busy === `req-${s.accountId}`} onClick={() => void run(`req-${s.accountId}`, () => peopleApi.sendRequest(s.accountId, mode))}>
                      Say hello
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </Card>
      )}

      {me.outgoing.some((o) => o.status === "accepted" && o.conversationId) && (
        <Card title="Accepted">
          {me.outgoing
            .filter((o) => o.status === "accepted" && o.conversationId)
            .map((o) => (
              <Button key={o.id} block onClick={() => router.push(`/people/chat/${o.conversationId}`)}>
                Chat with {o.toName}
              </Button>
            ))}
        </Card>
      )}

      <Card title="Invite someone you know">
        <p className="text-sm text-ink-2">Each code works three times and expires in two weeks. Only invite people you&rsquo;d vouch for, and withdraw a code if it was shared by mistake.</p>
        {newInvite && (
          <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
            <span className="font-mono text-ink">{newInvite}</span>
            <Button
              variant="ghost"
              size="sm"
              icon={<Copy className="size-4" />}
              onClick={() => {
                void navigator.clipboard?.writeText(newInvite).then(() => setCopied(true));
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
        <Button
          variant="secondary"
          block
          loading={busy === "invite"}
          onClick={() =>
            void run("invite", async () => {
              const inv = await peopleApi.createInvite();
              setNewInvite(inv.code);
              setCopied(false);
            })
          }
        >
          Create an invite code
        </Button>
        {me.invitations.length > 0 && (
          <ul className="divide-y divide-line">
            {me.invitations.map((i) => (
              <li key={i.code} className="flex items-center justify-between py-1.5 text-sm">
                <span className="font-mono text-ink">
                  {i.code} <span className="font-sans text-xs text-ink-3">· {i.usesLeft} use{i.usesLeft === 1 ? "" : "s"} left</span>
                </span>
                <Button variant="ghost" size="sm" loading={busy === `withdraw-${i.code}`} onClick={() => void run(`withdraw-${i.code}`, () => peopleApi.revokeInvite(i.code))}>
                  Withdraw
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Your connections">
        {me.connections.length === 0 ? (
          <p className="text-sm text-ink-2">No connections yet. Invite someone, or join with their code.</p>
        ) : (
          me.connections.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span className="text-ink">{c.displayName}</span>
              <Button variant="ghost" size="sm" onClick={() => void run(`revoke-${c.id}`, () => peopleApi.revokeConnection(c.id))}>
                Remove
              </Button>
            </div>
          ))
        )}
        <p className="text-xs text-ink-3">Only you see this list. Others see at most that you both know someone, and only if that person agreed.</p>
      </Card>

      <Card title="Privacy">
        <p className="text-sm text-ink-2">
          What we store and why is in the{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            privacy notice
          </Link>
          .
        </p>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" checked={me.account.discoverable} onChange={(e) => void run("discoverable", () => peopleApi.updateSettings({ discoverable: e.target.checked }))} className="mt-1 size-4 accent-accent" />
          <span>Let other members find me when I&rsquo;m looking for a chat</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" checked={me.account.shareAsMutual} onChange={(e) => void run("mutual", () => peopleApi.updateSettings({ shareAsMutual: e.target.checked }))} className="mt-1 size-4 accent-accent" />
          <span>Let two of my connections see &ldquo;You both know {me.account.displayName}&rdquo;</span>
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" block loading={busy === "signout"} onClick={() => void run("signout", () => peopleApi.signOut())}>
            Sign out
          </Button>
          <Button
            variant="danger"
            block
            loading={busy === "delete"}
            onClick={() => {
              if (window.confirm("Delete your account? This removes your profile, connections, invitations and the messages you sent, and signs you out. It can't be undone."))
                void run("delete", () => peopleApi.deleteAccount());
            }}
          >
            Delete account
          </Button>
        </div>
      </Card>
    </>
  );
}

/** Status plus, when enabled, the member view (null when not joined). */
async function fetchPeopleState(): Promise<{ status: StatusView; me: MeView | null }> {
  const status = await peopleApi.status();
  if (!status.enabled || !status.joined) return { status, me: null };
  try {
    return { status, me: await peopleApi.me() };
  } catch (e) {
    if (e instanceof PeopleApiError && e.status === 401) return { status, me: null };
    throw e;
  }
}

export function PeopleScreen() {
  const [state, setState] = useState<{ status: StatusView | null; me: MeView | null | undefined; failed: boolean }>({ status: null, me: undefined, failed: false });
  const { status, me, failed } = state;
  const timer = useRef<number | null>(null);
  const mode = useHello((s) => s.mode);

  const refresh = useCallback(
    () =>
      fetchPeopleState().then(
        (r) => setState({ status: r.status, me: r.me, failed: false }),
        () => setState((s) => ({ ...s, failed: true })),
      ),
    [],
  );

  useEffect(() => {
    track("human_mode_viewed", { mode });
    void refresh();
  }, [refresh, mode]);

  // Poll while a member is on this screen so requests and acceptances show up.
  useEffect(() => {
    if (!status?.enabled || !me) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    timer.current = window.setInterval(tick, 3000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [status?.enabled, me, refresh]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-[calc(var(--safe-top)+10px)]">
      <Link href="/" className="-ml-2 inline-flex h-11 w-fit items-center gap-1.5 rounded-md px-2 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </Link>
      <div className="flex items-center gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-mint text-mint-ink">
          <UsersRound className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="display text-[34px] text-ink">Mates</h1>
          <p className="text-sm text-ink-3">Real people, invite-only. Separate from the AI demo.</p>
        </div>
      </div>

      {failed ? (
        <Card>
          <p className="text-sm text-ink-2">Couldn&rsquo;t reach the server. Please try again.</p>
          <Button variant="secondary" onClick={() => void refresh()}>
            Retry
          </Button>
        </Card>
      ) : status === null ? (
        <p className="text-sm text-ink-3">Checking…</p>
      ) : !status.enabled ? (
        <DisabledView />
      ) : (
        <>
          {status.backend === "memory" && (
            <Card tone="warning">
              <p className="text-sm leading-relaxed text-ink">
                <strong>Local test mode.</strong> Accounts and chats live in this server&rsquo;s memory and reset when it restarts. Nobody&rsquo;s identity is
                checked. For trying the flow only.
              </p>
            </Card>
          )}
          {status.auth === "supabase" && !status.signedIn ? (
            <SignIn onSignedIn={() => void refresh()} />
          ) : !status.joined ? (
            <JoinForm onJoined={() => void refresh()} />
          ) : me ? (
            <Dashboard me={me} refresh={() => void refresh()} />
          ) : (
            <p className="text-sm text-ink-3">Loading…</p>
          )}
        </>
      )}
    </div>
  );
}
