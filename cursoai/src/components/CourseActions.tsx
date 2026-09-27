import { useState } from 'react';
import { Copy, Link2, Pause, Play, PlusCircle, RotateCcw, Trash2 } from 'lucide-react';
import type { CourseSummary } from '../../shared/types';
import { api, ApiError } from '../lib/api';
import { navigate } from '../lib/router';
import { Dialog, useToast } from './ui';

type Kind = 'delete' | 'reset' | 'share' | 'content' | null;

/** Library operations for one course: pause/resume, duplicate, share, add content, reset, delete. */
export function CourseActions({ course, onChanged, compact = false }: { course: CourseSummary; onChanged: () => void; compact?: boolean }) {
  const toast = useToast();
  const [dialog, setDialog] = useState<Kind>(null);
  const [busy, setBusy] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const started = course.status === 'active' || course.status === 'paused' || course.status === 'completed';

  async function act<T>(fn: () => Promise<T>, ok: string, after?: (r: T) => void) {
    setBusy(true);
    try {
      const r = await fn();
      toast(ok);
      after?.(r);
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo completar la acción.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const btn = compact ? 'btn-ghost px-2.5 text-xs' : 'btn-secondary text-xs';
  const shareUrl = shareCode ? `${window.location.origin}/#/compartido/${shareCode}` : '';

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {course.status === 'active' && (
          <button className={btn} disabled={busy} onClick={() => act(() => api.updateCourse(course.id, { status: 'paused' }), 'Curso pausado')}>
            <Pause className="h-4 w-4" aria-hidden /> Pausar
          </button>
        )}
        {course.status === 'paused' && (
          <button className={btn} disabled={busy} onClick={() => act(() => api.updateCourse(course.id, { status: 'active' }), 'Curso reanudado')}>
            <Play className="h-4 w-4" aria-hidden /> Reanudar
          </button>
        )}
        {course.status !== 'diagnosing' && (
          <button
            className={btn}
            disabled={busy}
            onClick={() => act(() => api.duplicateCourse(course.id), 'Curso duplicado: revisa y acepta su plan', (r) => navigate(`/curso/${r.course_id}/plan`))}
          >
            <Copy className="h-4 w-4" aria-hidden /> Duplicar
          </button>
        )}
        {course.status !== 'diagnosing' && (
          <button
            className={btn}
            disabled={busy}
            onClick={() =>
              act(() => api.shareCourse(course.id, !course.shared), course.shared ? 'Ya no se comparte' : 'Enlace creado', (r) => {
                if (r.share_code) {
                  setShareCode(r.share_code);
                  setDialog('share');
                }
              })
            }
          >
            <Link2 className="h-4 w-4" aria-hidden /> {course.shared ? 'Dejar de compartir' : 'Compartir'}
          </button>
        )}
        {started && (
          <button className={btn} disabled={busy} onClick={() => setDialog('content')}>
            <PlusCircle className="h-4 w-4" aria-hidden /> Agregar contenido
          </button>
        )}
        {started && (
          <button className={btn} disabled={busy} onClick={() => setDialog('reset')}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Reiniciar
          </button>
        )}
        <button className={`${btn} text-rose-600`} disabled={busy} onClick={() => setDialog('delete')}>
          <Trash2 className="h-4 w-4" aria-hidden /> Eliminar
        </button>
      </div>

      <Dialog open={dialog === 'delete'} title="¿Eliminar este curso?" onClose={() => setDialog(null)}>
        <p className="text-sm text-slate-600">Se borrarán el curso, tu progreso, respuestas y conversación con el tutor. No se puede deshacer.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDialog(null)}>
            Cancelar
          </button>
          <button className="btn-danger" disabled={busy} onClick={() => act(() => api.deleteCourse(course.id), 'Curso eliminado', () => { setDialog(null); navigate('/cursos'); })}>
            Eliminar
          </button>
        </div>
      </Dialog>

      <Dialog open={dialog === 'reset'} title="¿Reiniciar el progreso?" onClose={() => setDialog(null)}>
        <p className="text-sm text-slate-600">Conservas el plan y las actividades, pero se borran respuestas, dominio de conceptos, evaluaciones y certificado.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDialog(null)}>
            Cancelar
          </button>
          <button className="btn-danger" disabled={busy} onClick={() => act(() => api.resetCourse(course.id), 'Progreso reiniciado', () => setDialog(null))}>
            Reiniciar
          </button>
        </div>
      </Dialog>

      <Dialog open={dialog === 'share'} title="Compartir curso" onClose={() => setDialog(null)}>
        <p className="text-sm text-slate-600">Quien tenga el enlace podrá ver el plan e importarlo a su cuenta. Tu progreso y tus respuestas no se comparten.</p>
        <div className="mt-3 flex gap-2">
          <input className="input text-sm" readOnly value={shareUrl} aria-label="Enlace para compartir" onFocus={(e) => e.currentTarget.select()} />
          <button
            className="btn-primary shrink-0"
            onClick={() => {
              navigator.clipboard?.writeText(shareUrl).then(() => toast('Enlace copiado'), () => toast('Copia el enlace manualmente', 'info'));
            }}
          >
            Copiar
          </button>
        </div>
      </Dialog>

      <Dialog open={dialog === 'content'} title="Agregar contenido" onClose={() => setDialog(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!content.trim()) return;
            void act(() => api.addContent(course.id, content.trim()), 'Nueva etapa agregada', () => {
              setContent('');
              setDialog(null);
            });
          }}
        >
          <label htmlFor="add-content" className="label">
            ¿Qué quieres agregar a este curso?
          </label>
          <input
            id="add-content"
            className="input"
            placeholder="Ej.: tablas dinámicas, vocabulario de entrevistas…"
            value={content}
            maxLength={600}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">La IA diseñará una etapa nueva sin cambiar tu progreso.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDialog(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy || !content.trim()}>
              {busy ? 'Creando etapa…' : 'Agregar'}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
