import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MODE_COPY } from "@/lib/matching";

export const metadata = { title: "How it works" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] bg-[linear-gradient(180deg,#171a24,#12141c)] p-5 shadow-card">
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
          and never claims to be a person. When HELLO has a language model switched on, your messages to a character are sent through HELLO&rsquo;s
          server to Anthropic, which writes the reply; HELLO&rsquo;s server doesn&rsquo;t keep them. Otherwise a simple engine in your browser
          replies and nothing is sent anywhere.
        </p>
        <p>
          Characters remember the conversation you&rsquo;re in. If you allow it, they also remember a few things across chats, like your name or
          your dog&rsquo;s name. You can see, edit and delete those in Profile, under What hello remembers.
        </p>
      </Section>

      <Section title="Real people">
        <p>
          Chatting with real people is a private, invite-only beta. Members sign in with an emailed code and tap <strong className="text-ink">Start a conversation</strong>{" "}
          when they genuinely have time. A conversation only starts when the other person accepts, and anyone can leave, block or report at any time.
        </p>
        <p>
          If nobody is free, hello tells you and offers an AI character instead. That&rsquo;s your choice: an AI is never put in a person&rsquo;s place.{" "}
          <Link href="/people" className="text-ink underline-offset-4 hover:underline">
            Mates
          </Link>
        </p>
      </Section>

      <Section title="Your data">
        <p>
          AI conversations, preferences and anonymous usage events are stored in your browser only. Clear them any time from Profile. The AI demo
          doesn&rsquo;t ask for your contacts, location or email. For the mates beta, see the{" "}
          <Link href="/privacy" className="text-ink underline-offset-4 hover:underline">
            privacy notice
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
