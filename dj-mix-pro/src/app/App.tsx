import { useEffect } from 'react';
import { useDjStore } from '../state/useDjStore';
import { DeckPanel } from '../ui/deck/DeckPanel';
import { TopBar } from '../ui/layout/TopBar';
import { MixerPanel } from '../ui/mixer/MixerPanel';

export function App() {
  const status = useDjStore((s) => s.status);
  const message = useDjStore((s) => s.statusMessage);
  const start = useDjStore((s) => s.startEngine);
  const engine = useDjStore((s) => s.engine);

  // Reanuda el audio si el sistema lo suspendió (iOS) en el siguiente toque.
  useEffect(() => {
    if (!engine) return;
    const resume = () => void engine.resume();
    window.addEventListener('pointerdown', resume);
    return () => window.removeEventListener('pointerdown', resume);
  }, [engine]);

  if (status !== 'ready') {
    return (
      <main className="splash">
        <h1>
          DJ MIX <span>PRO</span>
        </h1>
        <p>Mezcladora de 2 decks · Fase 1</p>
        <button
          className="btn start"
          onClick={() => void start()}
          disabled={status === 'starting'}
          data-testid="start"
        >
          {status === 'starting' ? 'Iniciando motor…' : 'TOCA PARA INICIAR'}
        </button>
        <p className="fine">
          El audio se activa con un toque (requisito de los navegadores móviles). Usa sólo archivos que
          tengas derecho a reproducir.
        </p>
        {status === 'error' && <p className="error">{message}</p>}
      </main>
    );
  }

  return (
    <div className="app">
      <TopBar />
      <main className="console">
        <DeckPanel id="A" />
        <MixerPanel />
        <DeckPanel id="B" />
      </main>
      {message && (
        <div className="toast" role="status" onClick={() => useDjStore.setState({ statusMessage: null })}>
          {message}
        </div>
      )}
      <div className="rotate-hint">Gira el dispositivo a horizontal para la mejor experiencia ↻</div>
    </div>
  );
}
