import { eqKnobToDb, trimKnobToDb } from '../../engine/mixer/curves';
import type { XfAssign } from '../../engine/mixer/ChannelStrip';
import { useDjStore } from '../../state/useDjStore';
import { Fader } from '../controls/Fader';
import { Knob } from '../controls/Knob';
import { Meter } from '../controls/Meter';

const fmtDb = (db: number) => (db <= -39.5 ? 'KILL' : `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`);

function ChannelColumn({ index }: { index: 0 | 1 }) {
  const c = useDjStore((s) => s.channels[index]);
  const setChannel = useDjStore((s) => s.setChannel);
  const meter = useDjStore((s) => s.engine?.mixer.channels[index].meter);
  const deckId = index === 0 ? 'A' : 'B';
  const accent = index === 0 ? 'var(--deck-a)' : 'var(--deck-b)';

  return (
    <div className={`channel channel-${deckId.toLowerCase()}`} aria-label={`Canal ${deckId}`}>
      <div className="channel-tag" style={{ color: accent }}>{deckId}</div>
      <div className="channel-knobs">
      <Knob
        label="GAIN"
        value={c.trim}
        bipolar
        accent={accent}
        format={(v) => fmtDb(trimKnobToDb(v))}
        onChange={(v) => setChannel(index, 'trim', v)}
        testId={`trim-${deckId}`}
      />
      <Knob label="HIGH" value={c.high} bipolar accent={accent} format={(v) => fmtDb(eqKnobToDb(v))} onChange={(v) => setChannel(index, 'high', v)} testId={`eq-high-${deckId}`} />
      <Knob label="MID" value={c.mid} bipolar accent={accent} format={(v) => fmtDb(eqKnobToDb(v))} onChange={(v) => setChannel(index, 'mid', v)} testId={`eq-mid-${deckId}`} />
      <Knob label="LOW" value={c.low} bipolar accent={accent} format={(v) => fmtDb(eqKnobToDb(v))} onChange={(v) => setChannel(index, 'low', v)} testId={`eq-low-${deckId}`} />
      <Knob
        label="FILTER"
        value={c.filter}
        min={-1}
        max={1}
        bipolar
        accent="var(--filter)"
        format={(v) => (Math.abs(v) < 0.03 ? 'OFF' : v < 0 ? 'LPF' : 'HPF')}
        onChange={(v) => setChannel(index, 'filter', v)}
        hint="Izquierda: pasa-bajos · Derecha: pasa-altos · Doble toque: centro"
        testId={`filter-${deckId}`}
      />
      <button
        className={`btn cue-pfl ${c.cue ? 'on' : ''}`}
        onClick={() => setChannel(index, 'cue', !c.cue)}
        aria-pressed={c.cue}
        title="Escuchar este canal en auriculares (PFL)"
        data-testid={`pfl-${deckId}`}
      >
        🎧 CUE
      </button>
      </div>
      <div className="channel-fader-row">
        <Meter meter={meter} label={`Nivel ${deckId}`} testId={`meter-${deckId}`} />
        <Fader
          label={`Volumen ${deckId}`}
          value={c.fader}
          className="channel-fader"
          onChange={(v) => setChannel(index, 'fader', v)}
          testId={`fader-${deckId}`}
        />
      </div>
      <div className="assign" role="group" aria-label={`Asignación crossfader ${deckId}`}>
        {(['A', 'THRU', 'B'] as XfAssign[]).map((a) => (
          <button
            key={a}
            className={`btn tiny ${c.assign === a ? 'on' : ''}`}
            onClick={() => setChannel(index, 'assign', a)}
            title={a === 'THRU' ? 'Ignora el crossfader' : `Asignar al lado ${a} del crossfader`}
          >
            {a === 'THRU' ? 'THR' : a}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MixerPanel() {
  const s = useDjStore();
  const masterMeter = s.engine?.mixer.masterMeter;

  return (
    <section className="mixer" aria-label="Mixer">
      <div className="mixer-channels">
        <ChannelColumn index={0} />
        <div className="mixer-center">
          <div className="center-title">MASTER</div>
          <Knob label="VOL" value={s.master} defaultValue={0.8} accent="var(--master)" onChange={s.setMaster} testId="master" />
          <Meter meter={masterMeter} segments={18} label="Nivel master" testId="meter-master" />
          <div className="center-title phones">AURIC.</div>
          <Knob
            label="CUE/MST"
            value={s.phonesMix}
            size={38}
            accent="var(--master)"
            format={(v) => (v < 0.05 ? 'CUE' : v > 0.95 ? 'MASTER' : 'MIX')}
            onChange={s.setPhonesMix}
            hint="Mezcla en auriculares: CUE ↔ MASTER (requiere salida Split o 4 canales)"
          />
          <Knob label="NIVEL" value={s.phonesLevel} size={38} defaultValue={0.8} accent="var(--master)" onChange={s.setPhonesLevel} />
        </div>
        <ChannelColumn index={1} />
      </div>
      <div className="xfader-row">
        <span className="xf-label a">A</span>
        <Fader
          label="Crossfader"
          value={s.crossfader}
          min={-1}
          max={1}
          orientation="horizontal"
          centerDetent
          className="crossfader"
          onChange={s.setCrossfader}
          testId="crossfader"
        />
        <span className="xf-label b">B</span>
        <button
          className="btn tiny"
          onClick={() => s.setXfCurve(s.xfCurve === 'smooth' ? 'sharp' : 'smooth')}
          title="Curva del crossfader: suave (mezcla) o corte (scratch)"
          data-testid="xf-curve"
        >
          {s.xfCurve === 'smooth' ? '⌒ MIX' : '⊓ CUT'}
        </button>
      </div>
    </section>
  );
}
