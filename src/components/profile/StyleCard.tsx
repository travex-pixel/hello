"use client";

import { useHello } from "@/lib/conversation/store";

const FIELD = "w-full rounded-2xl border border-line bg-black/30 px-4 py-3 text-[16px] text-ink shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] placeholder:text-ink-3";

/** "Make it more like me": optional, a sentence and a few example messages. */
export function StyleCard({ Card }: { Card: (p: { title: string; children: React.ReactNode }) => React.ReactNode }) {
  const style = useHello((s) => s.preferences.style);
  const setPreferences = useHello((s) => s.setPreferences);
  const examples = [0, 1, 2].map((i) => style?.examples?.[i] ?? "");

  const save = (patch: { about?: string; examples?: string[] }) => setPreferences({ style: { ...style, ...patch } });

  return (
    <Card title="Text more like me">
      <p className="text-sm text-ink-3">Optional. Characters lean towards your rhythm and humour, and stay themselves.</p>
      <div>
        <label htmlFor="style-about" className="mb-2 block text-sm font-medium text-ink">
          How do you text?
        </label>
        <textarea
          id="style-about"
          rows={2}
          maxLength={200}
          value={style?.about ?? ""}
          onChange={(e) => save({ about: e.target.value })}
          placeholder="Short messages, dry humour, too many 'haha's"
          className={`${FIELD} resize-none`}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-ink">A few messages you&rsquo;d actually send</p>
        <div className="flex flex-col gap-2">
          {examples.map((value, i) => (
            <input
              key={i}
              aria-label={`Example message ${i + 1}`}
              maxLength={160}
              value={value}
              onChange={(e) => {
                const next = [...examples];
                next[i] = e.target.value;
                save({ examples: next });
              }}
              placeholder={["no way 😂", "honestly can't be bothered today", "ok but hear me out"][i]}
              className={`${FIELD} h-[52px] py-0`}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
