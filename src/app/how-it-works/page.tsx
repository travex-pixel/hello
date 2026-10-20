import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MODE_COPY } from "@/lib/matching";

export const metadata = { title: "How it works" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-surface p-4 shadow-card">
      <h2 className="display text-[22px] text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-[calc(var(--safe-top)+10px)]">
      <Link href="/" className="-ml-2 inline-flex h-11 w-fit items-center gap-1.5 rounded-md px-2 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </Link>
      <h1 className="display text-[34px] text-ink">How hello works</h1>

      <Section title="One tap">
        <p>Pick what you&rsquo;re in the mood for, tap the button, and meet someone within seconds. No profile, no photos, no sign-up.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">{MODE_COPY.bored.label}:</strong> light, playful, entertaining.
          </li>
          <li>
            <strong className="text-ink">{MODE_COPY.warmup.label}:</strong> an easy, unhurried chat with simple questions first.
          </li>
          <li>
            <strong className="text-ink">{MODE_COPY.surprise.label}:</strong> unexpected questions from someone unlike you.
          </li>
        </ul>
      </Section>

      <Section title="The AI demo">
        <p>
          Today you meet AI characters. Each one is labelled <strong className="text-ink">AI</strong> wherever they appear, will say so if you ask,
          and never claims to be a person. Their replies come from a local engine on your device by default, so nothing is sent anywhere and no
          account or API key is needed.
        </p>
        <p>They remember what you tell them within a conversation (your name, what you like) and forget it when you clear your history.</p>
      </Section>

      <Section title="Real people, later">
        <p>
          Real-people mode is designed as an invite-only community where you meet friends of friends who have said they&rsquo;re up for a chat right
          now. Both people have to accept before a conversation starts, availability switches off by itself, and you can block or report anyone.
        </p>
        <p>
          It is not enabled on this deployment. If nobody is available you&rsquo;ll be told so, and offered the AI demo as an option, never an AI
          pretending to be a person.{" "}
          <Link href="/people" className="text-ink underline-offset-4 hover:underline">
            Details
          </Link>
        </p>
      </Section>

      <Section title="Your data">
        <p>
          Demo conversations, preferences and anonymous usage events are stored in your browser only. Clear them any time from Profile. The app does
          not ask for your contacts, location or email to try the demo.
        </p>
      </Section>
    </div>
  );
}
