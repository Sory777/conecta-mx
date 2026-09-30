// Prueba E2E con navegador real: dos jugadores (escritorio + móvil táctil) entran al mundo,
// se ven, forman grupo y uno habla con el NPC del misterio. Guarda capturas en e2e-output/.
// Requisitos: `npm run build` y un Chromium de Playwright (`npx playwright install chromium`).
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'e2e-output');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const PORT = process.env.E2E_PORT ?? '8790';
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--import', 'tsx', 'src/index.ts'], {
  cwd: path.join(root, 'server'),
  env: { ...process.env, PORT, HOST: '127.0.0.1', NODE_ENV: 'test', DATABASE_PATH: path.join(out, 'e2e.db'), AUTH_RATE_PER_10MIN: '1000', LOG_LEVEL: 'warn' },
  stdio: ['ignore', 'inherit', 'inherit'],
});
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);

async function waitHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not start');
}

import { writeSync } from 'node:fs';
/** Conduce al personaje como un joystick virtual hasta (x, z). */
async function walkTo(page, x, z, stopAt = 1.2) {
  for (let i = 0; i < 600; i++) {
    const d = await page.evaluate(([tx, tz, stop]) => {
      const g = window.__game;
      const dx = tx - g.pos.x;
      const dz = tz - g.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < stop) {
        g.input.touchMove.x = 0;
        g.input.touchMove.y = 0;
        return dist;
      }
      const yaw = g.follow.yaw;
      const nx = dx / dist;
      const nz = dz / dist;
      g.input.touchMove.y = (nx * -Math.sin(yaw) + nz * -Math.cos(yaw)) * 0.8;
      g.input.touchMove.x = (nx * Math.cos(yaw) + nz * -Math.sin(yaw)) * 0.8;
      return dist;
    }, [x, z, stopAt]);
    if (d < stopAt) return;
    await page.waitForTimeout(80);
  }
  throw new Error(`No se llegó a (${x}, ${z})`);
}

const log = (...a) => writeSync(1, `[e2e] ${a.join(' ')}\n`);
const launchOpts = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

async function newPlayer(browser, name, mobile) {
  const ctx = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 720 } },
  );
  await ctx.addInitScript(() => {
    localStorage.setItem('mol.settings', JSON.stringify({ quality: 'low' }));
    localStorage.setItem('mol.debug', '1');
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => (errors.push(String(e)), console.error('[page error]', name, String(e))));
  page.on('console', (m) => m.type() === 'error' && (errors.push(m.text()), console.error('[console]', name, m.text())));
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByPlaceholder('Correo electrónico').fill(`${name}@e2e.dev`);
  await page.getByPlaceholder(/Usuario/).fill(name);
  await page.getByPlaceholder(/Contraseña/).fill('clave-segura-1');
  for (const cb of await page.locator('input[type=checkbox]').all()) await cb.check();
  await page.getByRole('button', { name: 'Crear cuenta' }).last().click();
  await page.getByPlaceholder('Nombre de tu investigador').fill(name === 'ana_e2e' ? 'Ana Lucero' : 'Beto Sombra');
  await page.locator('.swatch').nth(9).click();
  await page.screenshot({ path: path.join(out, `${name}-1-personaje.png`) });
  await page.getByRole('button', { name: 'Comenzar la investigación' }).click();
  await page.locator('.objective').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

const pages = {};
try {
  await waitHealth();
  const browser = await chromium.launch({ ...launchOpts, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const A = await newPlayer(browser, 'ana_e2e', false);
  pages.A = A.page;
  await A.page.screenshot({ path: path.join(out, 'ana-2-mundo.png') });
  log('A en el mundo');
  const B = await newPlayer(browser, 'beto_e2e', true);
  pages.B = B.page;
  await B.page.screenshot({ path: path.join(out, 'beto-2-movil.png') });
  log('B (móvil) en el mundo');

  // A ve a B en la lista de jugadores
  await A.page.keyboard.press('KeyP');
  await A.page.getByRole('button', { name: 'Jugadores', exact: true }).click();
  await A.page.getByText('Beto Sombra').waitFor({ timeout: 8000 });
  log('A ve a B ✔');
  await A.page.getByRole('button', { name: 'Invitar', exact: true }).first().click();
  await A.page.keyboard.press('Escape');
  await B.page.getByRole('button', { name: 'Aceptar' }).click({ timeout: 8000 });
  await A.page.waitForTimeout(800);
  log('Grupo formado ✔');

  // A camina hacia Don Aurelio y habla con él
  await walkTo(A.page, 3.4, 7.0);
  await A.page.locator('.prompt:not(.hidden)').waitFor({ timeout: 30000 });
  await A.page.screenshot({ path: path.join(out, 'ana-3-aviso.png') });
  await A.page.keyboard.press('KeyE');
  await A.page.locator('.dialogue:not(.hidden)').waitFor({ timeout: 30000 });
  await A.page.screenshot({ path: path.join(out, 'ana-4-dialogo.png') });
  for (let i = 0; i < 4; i++) {
    await A.page.keyboard.press('KeyE');
    await A.page.waitForTimeout(150);
  }
  await A.page.waitForTimeout(600);
  const objective = await A.page.locator('.objective').innerText();
  log('Objetivo tras hablar:', objective.replace(/\n/g, ' | '));
  if (!/pozo/i.test(objective)) throw new Error('El misterio no avanzó a la etapa del pozo');
  await A.page.keyboard.press('KeyJ');
  await A.page.waitForTimeout(300);
  await A.page.screenshot({ path: path.join(out, 'ana-5-diario.png') });
  await A.page.keyboard.press('Escape');
  await A.page.keyboard.press('KeyM');
  await A.page.waitForTimeout(500);
  await A.page.screenshot({ path: path.join(out, 'ana-6-mapa.png') });
  await A.page.keyboard.press('Escape');
  // Chat
  await A.page.keyboard.press('Enter');
  await A.page.keyboard.type('¿Alguien vio la luz en la colina?');
  await A.page.keyboard.press('Enter');
  await B.page.getByText('¿Alguien vio la luz en la colina?').waitFor({ timeout: 5000 });
  log('Chat entre jugadores ✔');
  await B.page.screenshot({ path: path.join(out, 'beto-3-chat.png') });

  const errs = [...A.errors, ...B.errors].filter((e) => !/favicon|WebGL|GPU stall|swiftshader/i.test(e));
  if (errs.length) {
    console.error('Errores en consola del navegador:', errs);
    process.exitCode = 1;
  } else log('Sin errores de consola ✔');
  await browser.close();
  log('OK — capturas en e2e-output/');
} catch (e) {
  console.error('[e2e] FALLÓ:', e);
  for (const [n, pg] of Object.entries(pages)) {
    try {
      await pg.screenshot({ path: path.join(out, `fallo-${n}.png`) });
      console.error(`[e2e] estado ${n}:`, await pg.evaluate(() => {
        const g = window.__game;
        return g ? JSON.stringify({ pos: g.pos, mode: g.mode, paused: g.paused, nearest: g.nearestInteractable, fps: Math.round(g.fpsEstimate) }) : 'sin __game';
      }));
    } catch {}
  }
  process.exitCode = 1;
} finally {
  stop();
}
