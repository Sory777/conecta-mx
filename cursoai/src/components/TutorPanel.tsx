import { useEffect, useRef, useState } from 'react';
import { Bot, Send } from 'lucide-react';
import type { TutorMessage } from '../../shared/types';
import { api, ApiError } from '../lib/api';
import { Markdown } from './Markdown';
import { useToast } from './ui';

const QUICK = ['No entendí', 'Explícamelo más fácil', 'Dame otro ejemplo', 'Ponme un ejercicio', '¿Por qué mi respuesta está mal?'];

export function TutorPanel({
  courseId,
  lessonId,
  prefill,
  onQuizRequested,
}: {
  courseId: string;
  lessonId: string | null;
  prefill?: string | null;
  onQuizRequested?: () => void;
}) {
  const toast = useToast();
  const [messages, setMessages] = useState<TutorMessage[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api
      .tutor(courseId)
      .then((r) => setMessages(r.messages))
      .catch(() => setMessages([]));
  }, [courseId]);

  useEffect(() => {
    if (prefill) {
      setText(prefill);
      inputRef.current?.focus();
    }
  }, [prefill]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  async function send(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    setBusy(true);
    setText('');
    setMessages((prev) => [...(prev ?? []), { id: `tmp-${Date.now()}`, role: 'user', content: m, created_at: new Date().toISOString() }]);
    try {
      const r = await api.askTutor(courseId, m, lessonId);
      setMessages(r.messages);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'El tutor no respondió.', 'error');
      setMessages((prev) => (prev ?? []).filter((x) => !x.id.startsWith('tmp-')));
      setText(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages === null && <p className="text-sm text-slate-500">Cargando conversación…</p>}
        {messages?.length === 0 && (
          <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
            <p className="font-semibold">Soy tu tutor para este curso.</p>
            <p className="mt-1">Conozco tu objetivo, tu progreso y tus errores. Pregúntame lo que quieras o usa un atajo.</p>
          </div>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'}`}
            >
              {m.role === 'assistant' ? <Markdown text={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Bot className="h-4 w-4 animate-pulse" aria-hidden /> El tutor está pensando…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-200 bg-white p-3">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {QUICK.map((q) => (
            <button key={q} className="chip shrink-0 text-xs" disabled={busy} onClick={() => send(q)}>
              {q}
            </button>
          ))}
          {onQuizRequested && (
            <button className="chip shrink-0 text-xs" disabled={busy} onClick={onQuizRequested}>
              Hazme un examen
            </button>
          )}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <label htmlFor="tutor-input" className="sr-only">
            Mensaje para el tutor
          </label>
          <textarea
            id="tutor-input"
            ref={inputRef}
            rows={1}
            className="input max-h-32 min-h-[44px] resize-none py-2.5"
            placeholder="Pregúntale al tutor…"
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(text);
              }
            }}
          />
          <button type="submit" className="btn-primary px-3" disabled={busy || !text.trim()} aria-label="Enviar">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
