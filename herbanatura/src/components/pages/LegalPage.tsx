import { Container, Notice } from '@/components/ui';

export type LegalSection = { h: string; p: string[] };

export function LegalPage({ title, updated, sections, reviewNote }: { title: string; updated: string; sections: LegalSection[]; reviewNote: string }) {
  return (
    <Container className="max-w-3xl py-10">
      <h1 className="font-serif text-4xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted">{updated}</p>
      <div className="mt-4"><Notice tone="warn">{reviewNote}</Notice></div>
      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-serif text-2xl font-semibold">{s.h}</h2>
            <div className="prose-hn mt-2 space-y-2 text-sm leading-relaxed">{s.p.map((x) => <p key={x}>{x}</p>)}</div>
          </section>
        ))}
      </div>
    </Container>
  );
}
