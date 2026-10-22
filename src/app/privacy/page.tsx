import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Privacy" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] bg-[linear-gradient(180deg,#171a24,#12141c)] p-5 shadow-card">
      <h2 className="display text-[22px] text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

/** Plain-language privacy notice for the private mates beta. */
export default function PrivacyPage() {
  const contact = process.env.HELLO_CONTACT_EMAIL;
  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-[calc(var(--safe-top)+10px)]">
      <Link href="/" className="-ml-2 inline-flex h-11 w-fit items-center gap-1.5 rounded-md px-2 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </Link>
      <h1 className="display text-[34px] text-ink">Privacy</h1>
      <p className="text-sm text-ink-3">For the private, invite-only beta of hello. Plain language, no small print.</p>

      <Section title="This is a beta">
        <p>hello is being tested by a small group of invited friends. Things may break, and features may change or be removed.</p>
      </Section>

      <Section title="What we store">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Your email address</strong>, to send you sign-in codes. Other members never see it.
          </li>
          <li>
            <strong className="text-ink">Your display name</strong> and any interests you chose to share. Other members see these.
          </li>
          <li>
            <strong className="text-ink">Who invited you</strong>, and who you invited.
          </li>
          <li>
            <strong className="text-ink">Your messages with other members</strong>, so both of you can come back to the conversation.
          </li>
          <li>
            <strong className="text-ink">When you&rsquo;re looking for a chat</strong>, for up to 30 minutes at a time.
          </li>
          <li>
            <strong className="text-ink">Blocks and reports</strong> you make, which keep only who, when and a short reason.
          </li>
        </ul>
        <p>We don&rsquo;t ask for your location, contacts, photos or phone number, and we don&rsquo;t sell or share data with advertisers.</p>
      </Section>

      <Section title="What we don't check">
        <p>
          A sign-in code proves you can read that inbox. It doesn&rsquo;t prove who you are. &ldquo;I&rsquo;m 18 or over&rdquo; is your own statement and isn&rsquo;t
          verified. Only chat with people you&rsquo;re comfortable with, and a shared friend isn&rsquo;t a guarantee of anyone&rsquo;s behaviour.
        </p>
      </Section>

      <Section title="Where it's kept">
        <p>
          Accounts and messages are stored in a Supabase database run by the beta owner. Sign-in codes are sent by email. The website is hosted on Vercel, which also
          counts anonymous page visits without cookies. Chats with AI characters stay on your device and are not stored on the server.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p>
          On the Mates screen, <strong className="text-ink">Delete account</strong> removes your profile, connections, invitations, the messages you sent and your
          sign-in email straight away. Conversations you were part of end, and the other person keeps only their own messages.
        </p>
        <p>
          Reports about safety are kept without message content for up to 6 months so problems can be looked into, then deleted. Everything else is deleted
          when the beta ends.
        </p>
      </Section>

      <Section title="Questions, reports and requests">
        <p>
          {contact ? (
            <>
              Email{" "}
              <a href={`mailto:${contact}`} className="text-ink underline underline-offset-2">
                {contact}
              </a>{" "}
              for anything about your data, or to follow up a report.
            </>
          ) : (
            <>Contact the person who invited you, who can reach the beta owner, for anything about your data or to follow up a report.</>
          )}
        </p>
      </Section>
    </div>
  );
}
