import { useState } from 'react';
import { CheckCircle2, AlertCircle, HelpCircle, MessageCircle, RotateCcw, XCircle } from 'lucide-react';
import type { AnswerResult, ExerciseDTO } from '../../shared/types';
import { api, ApiError } from '../lib/api';
import { EXERCISE_LABEL } from '../lib/format';
import { Markdown } from './Markdown';
import { MasteryBadge, useToast } from './ui';

type Turn = { role: 'alumno' | 'interlocutor'; text: string };

const VERDICT = {
  correct: { icon: CheckCircle2, label: 'Correcto', cls: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  partial: { icon: AlertCircle, label: 'Casi', cls: 'border-amber-200 bg-amber-50 text-amber-900' },
  incorrect: { icon: XCircle, label: 'Aún no', cls: 'border-rose-200 bg-rose-50 text-rose-900' },
};

export function ExerciseCard({
  exercise,
  index,
  onAnswered,
  onAskTutor,
}: {
  exercise: ExerciseDTO;
  index: number;
  onAnswered: (id: string, r: AnswerResult) => void;
  onAskTutor: (message: string) => void;
}) {
  const toast = useToast();
  const [response, setResponse] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(exercise.last_answer);
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>(exercise.context ? [{ role: 'interlocutor', text: exercise.context }] : []);
  const closed = exercise.kind === 'multiple_choice' || exercise.kind === 'true_false';
  const isConversation = exercise.kind === 'conversation';

  async function submit(value: string) {
    if (!value.trim()) return;
    setBusy(true);
    try {
      const r = await api.answer(exercise.id, value, isConversation ? turns : undefined);
      setResult(r);
      onAnswered(exercise.id, r);
      if (isConversation) {
        setTurns((t) => [...t, { role: 'alumno', text: value }, ...(r.next_turn ? [{ role: 'interlocutor' as const, text: r.next_turn }] : [])]);
        setResponse('');
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo enviar tu respuesta.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const v = result ? VERDICT[result.verdict] : null;
  const answeredClosed = closed && result !== null;
  const TF = [
    { value: 'true', label: 'Verdadero' },
    { value: 'false', label: 'Falso' },
  ];

  return (
    <section className="card p-4 sm:p-5" aria-labelledby={`ex-${exercise.id}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
        <span>Ejercicio {index + 1}</span>
        <span className="text-slate-300">•</span>
        <span className="text-slate-500">{EXERCISE_LABEL[exercise.kind]}</span>
      </div>
      <div id={`ex-${exercise.id}`} className="font-medium text-slate-900">
        <Markdown text={exercise.prompt} />
      </div>

      {exercise.context && !isConversation && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <Markdown text={exercise.context} />
        </div>
      )}

      {isConversation && (
        <div className="mt-3 space-y-2" aria-label="Conversación">
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'alumno' ? 'justify-end' : 'justify-start'}`}>
              <p
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${t.role === 'alumno' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'}`}
              >
                {t.text}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        {exercise.kind === 'multiple_choice' && (
          <fieldset className="space-y-2" disabled={busy || answeredClosed}>
            <legend className="sr-only">Elige una opción</legend>
            {exercise.options.map((opt, i) => {
              const selected = choice === String(i);
              return (
                <label
                  key={i}
                  className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${selected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'} ${answeredClosed ? 'cursor-default' : ''}`}
                >
                  <input type="radio" name={`mc-${exercise.id}`} value={i} checked={selected} onChange={() => setChoice(String(i))} className="h-4 w-4 accent-brand-600" />
                  <span>{opt}</span>
                </label>
              );
            })}
            {!answeredClosed && (
              <button className="btn-primary mt-1 w-full sm:w-auto" disabled={choice === null || busy} onClick={() => choice !== null && submit(choice)}>
                {busy ? 'Comprobando…' : 'Comprobar'}
              </button>
            )}
          </fieldset>
        )}

        {exercise.kind === 'true_false' && !answeredClosed && (
          <div className="grid grid-cols-2 gap-2">
            {TF.map((o) => (
              <button key={o.value} className="btn-secondary" disabled={busy} onClick={() => submit(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        )}

        {!closed && (!result || result.verdict !== 'correct' || (isConversation && result.next_turn)) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(response);
            }}
          >
            <label htmlFor={`ans-${exercise.id}`} className="sr-only">
              Tu respuesta
            </label>
            <textarea
              id={`ans-${exercise.id}`}
              className={`input min-h-[110px] ${exercise.kind === 'code' ? 'font-mono text-sm' : ''}`}
              placeholder={exercise.kind === 'code' ? 'Escribe tu código aquí…' : isConversation ? 'Escribe tu respuesta…' : 'Escribe tu respuesta…'}
              value={response}
              spellCheck={exercise.kind !== 'code'}
              onChange={(e) => setResponse(e.target.value)}
              onKeyDown={(e) => {
                if (exercise.kind === 'code' && e.key === 'Tab') {
                  e.preventDefault();
                  const t = e.currentTarget;
                  const s = t.selectionStart;
                  setResponse(response.slice(0, s) + '    ' + response.slice(t.selectionEnd));
                  requestAnimationFrame(() => t.setSelectionRange(s + 4, s + 4));
                }
              }}
              maxLength={8000}
            />
            <button type="submit" className="btn-primary mt-2 w-full sm:w-auto" disabled={busy || !response.trim()}>
              {busy ? 'Evaluando…' : result ? 'Enviar de nuevo' : 'Enviar respuesta'}
            </button>
          </form>
        )}
      </div>

      {result && v && (
        <div className={`mt-4 rounded-xl border p-3.5 text-sm ${v.cls}`} role="status" aria-live="polite">
          <div className="mb-1 flex flex-wrap items-center gap-2 font-semibold">
            <v.icon className="h-4 w-4" aria-hidden />
            <span>{v.label}</span>
            {result.mastery && <MasteryBadge state={result.mastery.state} />}
          </div>
          <Markdown text={result.feedback} />
          {result.correct_answer && result.verdict !== 'correct' && (
            <p className="mt-1">
              Respuesta correcta: <strong>{result.correct_answer}</strong>
            </p>
          )}
          {result.verdict !== 'correct' && (
            <div className="mt-2 flex flex-wrap gap-2">
              {!closed && (
                <button className="chip" onClick={() => setResult(null)}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden /> Intentar de nuevo
                </button>
              )}
              <button className="chip" onClick={() => onAskTutor(`¿Por qué mi respuesta está mal? Ejercicio: "${exercise.prompt.slice(0, 200)}"`)}>
                <HelpCircle className="mr-1 h-3.5 w-3.5" aria-hidden /> ¿Por qué está mal?
              </button>
            </div>
          )}
          {isConversation && result.next_turn && (
            <p className="mt-2 flex items-center gap-1 text-xs">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden /> La conversación continúa: responde arriba.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
