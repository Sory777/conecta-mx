/**
 * Prueba de humo E2E de la FASE 1 contra la build de producción en Chromium real:
 * carga de pistas, reproducción, CUE, pitch, crossfader, EQ, filtro y medidores.
 *
 *   npm run build && npm run e2e
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const OUT = join(process.cwd(), 'test-results');
mkdirSync(OUT, { recursive: true });

// ---------- Audio de prueba (WAV PCM 16-bit estéreo) ----------
function wav(path, seconds, fn, sr = 44100) {
  const n = Math.floor(seconds * sr);
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, fn(i / sr)));
    const s = Math.round(v * 32767);
    buf.writeInt16LE(s, 44 + i * 4);
    buf.writeInt16LE(s, 46 + i * 4);
  }
  writeFileSync(path, buf);
}
const bassFile = join(OUT, 'Test Artist - Bass Loop.wav');
const hiFile = join(OUT, 'Otro Artista - Hi Tone.wav');
wav(bassFile, 40, (t) => 0.5 * Math.sin(2 * Math.PI * 60 * t)); // graves puros: para el EQ LOW
wav(hiFile, 40, (t) => 0.5 * Math.sin(2 * Math.PI * 5000 * t)); // agudos: para el filtro LPF

// ---------- Servidor ----------
const PORT = 4789;
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.screenshot({ path: join(OUT, '00-splash.png') });

  await page.getByTestId('start').click();
  await page.getByTestId('load-A').waitFor();
  check('Motor de audio iniciado', await page.evaluate(() => window.__dj.ctx.state === 'running'));

  // Helpers que leen el motor real
  const pos = (id) => page.evaluate((d) => window.__dj.decks[d].player.position(), id);
  // Pico instantáneo real del analizador master (sin la caída visual del medidor).
  const masterDb = () =>
    page.evaluate(async () => {
      const an = window.__dj.mixer.masterMeter.input;
      const buf = new Float32Array(an.fftSize);
      let peak = 0;
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 25));
        an.getFloatTimeDomainData(buf);
        for (const v of buf) peak = Math.max(peak, Math.abs(v));
      }
      return peak > 0 ? 20 * Math.log10(peak) : -120;
    });
  const wait = (ms) => page.waitForTimeout(ms);
  const drag = async (testId, dx, dy) => {
    const box = await page.getByTestId(testId).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
    await page.mouse.move(x + dx, y + dy, { steps: 4 });
    await page.mouse.up();
    await wait(80); // evita que el siguiente gesto cuente como doble toque
    await wait(300);
  };

  // --- Carga ---
  await page.getByTestId('file-A').setInputFiles(bassFile);
  await page.getByTestId('file-B').setInputFiles(hiFile);
  await page.waitForFunction(() => document.querySelector('[data-testid="title-B"]').textContent === 'Hi Tone');
  check('Título/artista desde nombre de archivo', (await page.getByTestId('title-A').textContent()) === 'Bass Loop');
  const dur = await page.evaluate(() => window.__dj.decks.A.getState().track.duration);
  check('Duración decodificada', Math.abs(dur - 40) < 0.05, `${dur.toFixed(2)} s`);

  // --- Silencio inicial ---
  check('Master en silencio antes de PLAY', (await masterDb()) < -60);

  // --- PLAY ---
  await page.getByTestId('play-A').click();
  await wait(1500);
  const p1 = await pos('A');
  check('Deck A avanza al reproducir', p1 > 1.2 && p1 < 2.0, `${p1.toFixed(2)} s`);
  const dbPlaying = await masterDb();
  check('Master suena con Deck A', dbPlaying > -20, `${dbPlaying.toFixed(1)} dBFS`);
  const elapsedText = await page.getByTestId('elapsed-A').textContent();
  check('Display de tiempo actualizado', elapsedText !== '0:00.0', elapsedText);

  // --- Pitch +8 % (arrastrar hacia abajo = más rápido) ---
  await drag('pitch-A', 0, 400);
  const pitch = await page.evaluate(() => window.__dj.decks.A.getState().pitch);
  check('Pitch fader al máximo (+8 %)', Math.abs(pitch - 0.08) < 1e-6, pitch.toFixed(4));
  const a0 = await pos('A');
  const t0 = await page.evaluate(() => window.__dj.ctx.currentTime);
  await wait(2000);
  const a1 = await pos('A');
  const t1 = await page.evaluate(() => window.__dj.ctx.currentTime);
  const measuredRate = (a1 - a0) / (t1 - t0);
  check('Velocidad real ≈ 1.08', Math.abs(measuredRate - 1.08) < 0.01, measuredRate.toFixed(4));
  // doble toque = reset
  const pbox = await page.getByTestId('pitch-A').boundingBox();
  await page.mouse.click(pbox.x + pbox.width / 2, pbox.y + pbox.height / 2, { clickCount: 1 });
  await page.mouse.click(pbox.x + pbox.width / 2, pbox.y + pbox.height / 2, { clickCount: 1 });
  await wait(100);
  check('Doble toque resetea pitch', (await page.evaluate(() => window.__dj.decks.A.getState().pitch)) === 0);

  // --- EQ LOW kill sobre tono de 60 Hz ---
  await drag('eq-low-A', 0, 400);
  const dbKill = await masterDb();
  check('EQ LOW kill atenúa graves', dbKill < dbPlaying - 25, `${dbPlaying.toFixed(1)} → ${dbKill.toFixed(1)} dBFS`);
  await page.getByTestId('eq-low-A').focus();
  await page.keyboard.press('Home');
  await wait(300);

  // --- Crossfader todo a B: A debe callarse ---
  await drag('crossfader', 600, 0);
  const xf = await page.evaluate(() => document.querySelector('[data-testid="crossfader"]').getAttribute('aria-valuenow'));
  const dbXfB = await masterDb();
  check('Crossfader a B silencia A', dbXfB < -60, `xf=${xf}, ${dbXfB.toFixed(1)} dBFS`);

  // --- Deck B con filtro LPF ---
  await page.getByTestId('play-B').click();
  await wait(600);
  const dbB = await masterDb();
  check('Deck B suena por el lado B', dbB > -20, `${dbB.toFixed(1)} dBFS`);
  await drag('filter-B', 0, 400);
  const dbLpf = await masterDb();
  check('Filtro LPF atenúa tono de 5 kHz', dbLpf < dbB - 30, `${dbB.toFixed(1)} → ${dbLpf.toFixed(1)} dBFS`);

  // --- Fader de canal B a cero ---
  await page.getByTestId('filter-B').focus();
  await page.keyboard.press('Home');
  await drag('fader-B', 0, 400);
  check('Fader de canal B a 0 silencia', (await masterDb()) < -60);
  await page.getByTestId('fader-B').focus();
  await page.keyboard.press('Home');

  // --- Crossfader al centro: ambos suenan ---
  await page.getByTestId('crossfader').focus();
  await page.keyboard.press('Home');
  await wait(300);
  await page.screenshot({ path: join(OUT, '01-desktop-playing.png') });

  // --- CUE en reproducción: vuelve al punto CUE (0) y pausa ---
  await page.getByTestId('cue-A').click();
  await wait(300);
  const stA = await page.evaluate(() => ({ playing: window.__dj.decks.A.getState().playing, pos: window.__dj.decks.A.player.position() }));
  check('CUE en reproducción vuelve al punto y pausa', !stA.playing && stA.pos < 0.05, JSON.stringify(stA));

  // --- Búsqueda en la barra y nuevo punto CUE ---
  const sbox = await page.getByTestId('strip-A').boundingBox();
  await page.mouse.click(sbox.x + sbox.width * 0.5, sbox.y + sbox.height / 2);
  await wait(200);
  const seekPos = await pos('A');
  check('Seek por barra al 50 %', Math.abs(seekPos - 20) < 0.5, `${seekPos.toFixed(2)} s`);
  await page.getByTestId('cue-A').click();
  const cueP = await page.evaluate(() => window.__dj.decks.A.getState().cuePoint);
  check('CUE en pausa fija nuevo punto', Math.abs(cueP - seekPos) < 0.05, `${cueP.toFixed(2)} s`);

  // --- Mantener CUE = previsualizar; soltar = volver ---
  const cbox = await page.getByTestId('cue-A').boundingBox();
  await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
  await wait(400);
  await page.mouse.down();
  await wait(800);
  const during = await pos('A');
  await page.mouse.up();
  await wait(200);
  const after = await pos('A');
  check('Mantener CUE previsualiza', during > cueP + 0.4, `${during.toFixed(2)} s`);
  check('Soltar CUE regresa al punto', Math.abs(after - cueP) < 0.05, `${after.toFixed(2)} s`);

  // --- Modo de salida Split ---
  await page.getByTestId('settings').click();
  await page.getByLabel(/Split/).check();
  const mode = await page.evaluate(() => window.__dj.mixer.outputMode);
  check('Modo de salida Split', mode === 'split');
  await page.getByText('Cerrar').click();

  // --- Capturas en distintos tamaños ---
  await page.getByTestId('play-A').click();
  await wait(500);
  for (const [name, w, h] of [
    ['02-phone-landscape', 844, 390],
    ['03-tablet', 1024, 768],
    ['04-desktop-fhd', 1920, 1080],
    ['05-phone-portrait', 390, 844],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await wait(300);
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      return { x: de.scrollWidth > de.clientWidth, y: de.scrollHeight > de.clientHeight };
    });
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
    if (h < w) check(`Sin desbordamiento en ${w}×${h}`, !overflow.x && !overflow.y, JSON.stringify(overflow));
    else check(`Sin scroll horizontal en ${w}×${h}`, !overflow.x);
  }

  check('Sin errores de consola', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`);
process.exit(failed.length ? 1 : 0);
