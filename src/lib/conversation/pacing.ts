/**
 * Message pacing. A reply appears after a short, slightly variable pause
 * with the typing indicator showing, like someone texting back. The pause
 * runs from the moment the person sent their message, so model latency is
 * absorbed into it rather than added on top. Errors are never delayed.
 */

const SCALE = (() => {
  const v = Number(process.env.NEXT_PUBLIC_HELLO_TYPING_SCALE);
  return Number.isFinite(v) && v >= 0 ? v : 1;
})();

export function typingDelayMs(text: string, index: number, opts: { reduced?: boolean; random?: () => number; scale?: number } = {}): number {
  const scale = (opts.scale ?? SCALE) * (opts.reduced ? 0.5 : 1);
  if (scale === 0) return 0;
  const len = text.length;
  const base = index === 0 ? Math.min(2000, Math.max(700, 650 + len * 16)) : Math.min(1700, Math.max(450, 300 + len * 18));
  const jitter = 0.85 + (opts.random ?? Math.random)() * 0.3;
  return Math.round(base * jitter * scale);
}

export interface BubblePacer {
  push(text: string): void;
  /** No more bubbles are coming. */
  end(): void;
  /** Drop anything not yet shown. */
  cancel(): void;
  /** Resolves when everything pushed has been shown (after end), or on cancel. */
  readonly done: Promise<void>;
  readonly shown: number;
  readonly pending: number;
}

export function createBubblePacer(opts: {
  startedAt: number;
  delayFor: (text: string, index: number) => number;
  show: (text: string, index: number) => void;
  now?: () => number;
}): BubblePacer {
  const now = opts.now ?? Date.now;
  const queue: string[] = [];
  let ended = false;
  let cancelled = false;
  let shown = 0;
  let lastAt = opts.startedAt;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));

  const schedule = () => {
    if (timer || cancelled) return;
    if (queue.length === 0) {
      if (ended) resolve();
      return;
    }
    const text = queue[0];
    const wait = Math.max(0, lastAt + opts.delayFor(text, shown) - now());
    timer = setTimeout(() => {
      timer = null;
      if (cancelled) return;
      queue.shift();
      opts.show(text, shown);
      shown += 1;
      lastAt = now();
      schedule();
    }, wait);
  };

  return {
    push(text) {
      if (cancelled) return;
      queue.push(text);
      schedule();
    },
    end() {
      ended = true;
      schedule();
    },
    cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
      timer = null;
      queue.length = 0;
      resolve();
    },
    done,
    get shown() {
      return shown;
    },
    get pending() {
      return queue.length;
    },
  };
}
