import type { AnalyticsEvent, EventName, EventProps } from "./events";

const STORAGE_KEY = "hello.events";
const LAST_VISIT_KEY = "hello.lastVisit";
const MAX_EVENTS = 1000;
const RETURN_GAP_MS = 4 * 60 * 60 * 1000;

export interface AnalyticsSink {
  send(event: AnalyticsEvent): void;
}

let sessionId: string | null = null;
const sinks: AnalyticsSink[] = [];

function isBrowser() {
  return typeof window !== "undefined";
}

function getSession(): string {
  if (sessionId) return sessionId;
  try {
    const existing = sessionStorage.getItem("hello.session");
    if (existing) return (sessionId = existing);
    const fresh = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("hello.session", fresh);
    return (sessionId = fresh);
  } catch {
    return (sessionId = "s_" + Math.random().toString(36).slice(2, 8));
  }
}

export function readEvents(): AnalyticsEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

export function clearEvents() {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Register an additional sink (for example a hosted analytics provider). */
export function addSink(sink: AnalyticsSink) {
  sinks.push(sink);
}

export function track(name: EventName, props?: EventProps) {
  if (!isBrowser()) return;
  const event: AnalyticsEvent = { name, ts: Date.now(), session: getSession(), props };
  try {
    const events = readEvents();
    events.push(event);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    /* storage unavailable: drop the event rather than break the app */
  }
  for (const sink of sinks) {
    try {
      sink.send(event);
    } catch {
      /* a broken sink must never affect the product */
    }
  }
  if (process.env.NODE_ENV === "development") {
    console.debug("[hello] event", name, props ?? "");
  }
}

/** Call once per page load. Records a return visit when the last visit was a while ago. */
export function trackVisit() {
  if (!isBrowser()) return;
  try {
    const last = Number(localStorage.getItem(LAST_VISIT_KEY) ?? 0);
    const now = Date.now();
    if (last && now - last > RETURN_GAP_MS) {
      track("return_visit", { daysSinceLastVisit: Math.round((now - last) / 86_400_000) });
    }
    localStorage.setItem(LAST_VISIT_KEY, String(now));
  } catch {
    /* ignore */
  }
}
