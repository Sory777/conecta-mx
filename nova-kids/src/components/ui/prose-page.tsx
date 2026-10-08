import { PageHeader } from "./page-header";

export interface ProseSection {
  title: string;
  body: string[];
}

/** Página de texto (políticas, envíos, etc.). Edita el contenido en src/content/pages.ts. */
export function ProsePage({ title, description, sections, updated }: { title: string; description?: string; sections: ProseSection[]; updated?: string }) {
  return (
    <>
      <PageHeader eyebrow="NOVA KIDS" title={title} description={description} />
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-xl font-semibold text-white">{s.title}</h2>
              <div className="mt-3 space-y-3 leading-relaxed text-ink-muted">
                {s.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        {updated && <p className="mt-12 text-xs text-ink-faint">Última actualización: {updated}</p>}
      </div>
    </>
  );
}
