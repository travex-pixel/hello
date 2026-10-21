import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="display text-[30px] text-ink">That page doesn&rsquo;t exist</h1>
      <p className="text-sm text-ink-2">But there is always someone to talk to.</p>
      <Link href="/" className="mt-2 inline-flex h-12 items-center rounded-full bg-accent px-6 text-[15px] font-semibold text-ink-inverse shadow-button">
        Back to Discover
      </Link>
    </div>
  );
}
