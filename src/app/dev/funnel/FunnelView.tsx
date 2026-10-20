"use client";

import { useMemo, useSyncExternalStore } from "react";
import { computeFunnel } from "@/lib/analytics/funnel";
import { clearEvents, readEvents } from "@/lib/analytics/track";
import { Button } from "@/components/ui/Button";

function pct(n: number, d: number) {
  return d === 0 ? "–" : `${Math.round((n / d) * 100)}%`;
}

const EVENT = "hello:events";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
};
const getSnapshot = () => localStorage.getItem("hello.events") ?? "";
const getServerSnapshot = () => null;
const refresh = () => window.dispatchEvent(new Event(EVENT));

export function FunnelView() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const report = useMemo(() => (raw === null ? null : computeFunnel(readEvents())), [raw]);
  if (!report) return null;
  const rows: [string, string][] = [
    ["Sessions", String(report.sessions)],
    ["Tapped discover", `${report.sessionsWithTap} (${pct(report.sessionsWithTap, report.sessions)})`],
    ["Accepted a match", `${report.sessionsWithConnection} (${pct(report.sessionsWithConnection, report.sessionsWithTap)})`],
    ["Sent first message", `${report.sessionsWithFirstMessage} (${pct(report.sessionsWithFirstMessage, report.sessionsWithConnection)})`],
    ["Received a reply", `${report.sessionsWithResponse} (${pct(report.sessionsWithResponse, report.sessionsWithFirstMessage)})`],
    ["Conversations started", String(report.conversationsStarted)],
    ["Reached 5 messages", `${report.conversationsReachedFive} (${pct(report.conversationsReachedFive, report.conversationsStarted)})`],
    ["Started another", String(report.anotherConversationStarted)],
    ["Median ms to first message", report.medianMsToFirstMessage === null ? "–" : String(Math.round(report.medianMsToFirstMessage))],
    ["Feedback great / fine / not for me", `${report.feedback.great} / ${report.feedback.fine} / ${report.feedback.not_for_me}`],
    ["Mode selections", Object.entries(report.modeSelections).map(([k, v]) => `${k}: ${v}`).join(", ") || "–"],
    ["Return visits", String(report.returnVisits)],
  ];
  return (
    <div className="px-5 pt-[calc(var(--safe-top)+14px)]">
      <h1 className="display text-[30px] text-ink">Local funnel (dev only)</h1>
      <p className="mt-1 text-sm text-ink-3">Computed from events stored in this browser. No data leaves the device.</p>
      <table className="mt-4 w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-line">
              <td className="py-2 pr-3 text-ink-2">{k}</td>
              <td className="py-2 text-right font-mono text-ink">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={refresh}>
          Refresh
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            clearEvents();
            refresh();
          }}
        >
          Clear events
        </Button>
      </div>
    </div>
  );
}
