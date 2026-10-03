import { useState } from 'react';
import type { OutputMode } from '../../engine/mixer/Mixer';
import { useDjStore } from '../../state/useDjStore';

const MODE_LABEL: Record<OutputMode, string> = {
  stereo: 'Estéreo (master en L/R)',
  split: 'Split: master → derecha · auriculares → izquierda',
  quad: '4 canales: master 1-2 · auriculares 3-4',
};

export function TopBar() {
  const engine = useDjStore((s) => s.engine);
  const outputMode = useDjStore((s) => s.outputMode);
  const modes = useDjStore((s) => s.availableOutputModes);
  const setOutputMode = useDjStore((s) => s.setOutputMode);
  const [open, setOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="brand">
        DJ MIX <span>PRO</span>
      </div>
      <div className="topbar-center">
        <button className="btn ghost tiny" disabled title="Grabación de la mezcla — Fase 5">● REC</button>
        <button className="btn ghost tiny" disabled title="Efectos — Fase 4">FX</button>
        <button className="btn ghost tiny" disabled title="Sampler — Fase 4">SAMPLER</button>
        <button className="btn ghost tiny" disabled title="Biblioteca — Fase 5">BIBLIOTECA</button>
      </div>
      <div className="topbar-right">
        {engine && (
          <span className="latency" title="Latencia de salida estimada que reporta el navegador">
            {engine.ctx.sampleRate / 1000} kHz · {engine.outputLatencyMs.toFixed(0)} ms
          </span>
        )}
        <button className="btn tiny" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="settings">
          ⚙
        </button>
      </div>
      {open && (
        <div className="settings-pop" role="dialog" aria-label="Ajustes de audio">
          <h3>Salida de audio</h3>
          {(['stereo', 'split', 'quad'] as OutputMode[]).map((m) => (
            <label key={m} className={modes.includes(m) ? '' : 'disabled'}>
              <input
                type="radio"
                name="out"
                checked={outputMode === m}
                disabled={!modes.includes(m)}
                onChange={() => setOutputMode(m)}
              />
              {MODE_LABEL[m]}
              {!modes.includes(m) && <em> (tu dispositivo no expone 4 canales)</em>}
            </label>
          ))}
          <p className="note">
            Para escuchar el CUE en auriculares y el master en altavoces con una sola salida, usa un
            cable divisor (splitter) estéreo→2×mono y el modo Split. El navegador no permite enviar
            audio a dos dispositivos de salida a la vez desde un mismo contexto.
          </p>
          <button className="btn small" onClick={() => setOpen(false)}>Cerrar</button>
        </div>
      )}
    </header>
  );
}
