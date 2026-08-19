import Link from "next/link";
import { SITE_SHORT_NAME } from "@/lib/site";

type Section = Readonly<{ title: string; paragraphs: readonly string[] }>;
type InfoPageProps = Readonly<{
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: readonly Section[];
}>;

export function InfoPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
}: InfoPageProps) {
  return (
    <main className="min-h-screen bg-stage px-6 py-12 text-ink sm:px-10 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-line pb-10">
          <Link href="/" className="text-sm text-brand hover:text-brand-lite">
            {SITE_SHORT_NAME}
          </Link>
          <p className="mt-12 text-xs uppercase tracking-[0.28em] text-faint">{eyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-wide sm:text-5xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-sub">{intro}</p>
          <p className="mt-6 text-xs text-faint">最后更新：{updated}</p>
        </header>

        <div className="space-y-10 py-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-ink">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-8 text-sub">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="border-t border-line pt-6 text-sm text-faint">
          <Link href="/privacy" className="mr-5 hover:text-sub">隐私政策</Link>
          <Link href="/terms" className="mr-5 hover:text-sub">服务条款</Link>
          <Link href="/support" className="hover:text-sub">支持</Link>
        </footer>
      </div>
    </main>
  );
}
