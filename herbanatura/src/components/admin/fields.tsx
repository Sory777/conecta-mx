import type { ReactNode } from 'react';

const cls = 'mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm';

export function Field({ label, name, defaultValue, required, textarea, placeholder, hint }: { label: string; name: string; defaultValue?: string | null; required?: boolean; textarea?: boolean; placeholder?: string; hint?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {required && <span className="text-danger"> *</span>}
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue ?? ''} required={required} placeholder={placeholder} rows={3} className={cls} />
      ) : (
        <input name={name} defaultValue={defaultValue ?? ''} required={required} placeholder={placeholder} className={cls} />
      )}
      {hint && <span className="mt-0.5 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function Select({ label, name, options, defaultValue, multiple, required }: { label: string; name: string; options: [string, string][]; defaultValue?: string; multiple?: boolean; required?: boolean }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {required && <span className="text-danger"> *</span>}
      <select name={name} defaultValue={defaultValue} multiple={multiple} required={required} className={`${cls} ${multiple ? 'h-40' : ''}`}>
        {!multiple && !required && <option value="">—</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminForm({ action, children, disabled, submit = 'Guardar' }: { action: (fd: FormData) => Promise<void>; children: ReactNode; disabled: boolean; submit?: string }) {
  return (
    <form action={action} className="rounded-2xl border border-border bg-surface p-5">
      <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
        {children}
        <button className="rounded-lg bg-accent px-5 py-2 font-semibold text-white">{submit}</button>
      </fieldset>
      {disabled && <p className="mt-2 text-xs text-muted">Formulario desactivado en modo demostración.</p>}
    </form>
  );
}
