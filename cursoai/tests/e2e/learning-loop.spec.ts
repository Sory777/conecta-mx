import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS_DIR;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: true });
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(1);
}

test('goal → register → plan → modify → accept → learn → evaluate → adapt', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // 1. Landing: type a goal
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '¿Qué quieres aprender o conseguir?' })).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, '01-landing');
  await page.getByLabel('¿Qué quieres aprender o conseguir?').fill('Quiero aprender Excel para conseguir trabajo');
  await page.getByRole('button', { name: 'Empezar' }).click();

  // 2. Register; the goal survives sign-up
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
  await page.getByLabel('Nombre').fill('Lucía Pérez');
  await page.getByLabel('Correo electrónico').fill(`e2e${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`);
  await page.getByLabel('Contraseña').fill('contraseña-segura-1');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  // 3. Plan (no diagnosis needed: goal is explicit)
  await expect(page.getByText('Qué podrás hacer al terminar')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Al terminar podrás/)).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, '02-plan');
  const stagesBefore = await page.locator('ol > li').count();

  // 4. Modify the plan
  await page.getByRole('button', { name: 'Hazlo más corto' }).click();
  await expect(page.getByText('versión 2')).toBeVisible();
  expect(await page.locator('ol > li').count()).toBe(stagesBefore - 1);

  // 5. Accept → first activity
  await page.getByRole('button', { name: 'Aceptar plan y empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Practica', exact: true })).toBeVisible({ timeout: 30_000 });
  await noHorizontalScroll(page);
  await shot(page, '03-lesson');

  const finish = page.getByRole('button', { name: /Responde \d ejercicio/ });
  await expect(finish).toBeDisabled();

  // 6. Exercises: multiple choice, true/false, open answer (AI-graded)
  const cards = page.locator('section[aria-labelledby^="ex-"]');
  await cards.nth(0).getByRole('radio').first().check();
  await cards.nth(0).getByRole('button', { name: 'Comprobar' }).click();
  await expect(cards.nth(0).getByText('Correcto', { exact: true })).toBeVisible();

  await cards.nth(1).getByRole('button', { name: 'Verdadero' }).click();
  await expect(cards.nth(1).getByText('Aún no')).toBeVisible();
  await expect(cards.nth(1).getByText(/Respuesta correcta: Falso/)).toBeVisible();

  await cards.nth(2).getByLabel('Tu respuesta').fill('Es un elemento clave para resolver tareas concretas, por ejemplo organizar información del trabajo.');
  await cards.nth(2).getByRole('button', { name: 'Enviar respuesta' }).click();
  await expect(cards.nth(2).getByText('Correcto', { exact: true })).toBeVisible();
  await shot(page, '04-feedback');

  // 7. Tutor with course context
  await page.getByRole('button', { name: 'Abrir tutor' }).click();
  const tutor = page.getByRole('dialog', { name: 'Tutor personal' });
  await tutor.getByRole('button', { name: 'No entendí' }).click();
  await expect(tutor.getByText(/analogía/)).toBeVisible();
  await shot(page, '05-tutor');
  await tutor.getByRole('button', { name: 'Cerrar tutor' }).click();

  // 8. Smart regeneration of just this activity
  await page.getByRole('button', { name: 'Cambiar esta actividad' }).click();
  await page.getByRole('button', { name: 'Explícamelo como si tuviera 10 años' }).click();
  await expect(page.getByRole('group', { name: 'Versiones' }).getByRole('button', { name: 'Original' })).toBeVisible();
  await expect(page.getByText('Analogía')).toBeVisible();
  await page.getByRole('group', { name: 'Versiones' }).getByRole('button', { name: 'Original' }).click();

  // 9. Finish → adaptive next step
  await page.getByRole('button', { name: 'Terminar y continuar' }).click();
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('heading', { name: 'Practica', exact: true })).toBeVisible({ timeout: 30_000 });

  // 10. Course overview with mastery by competency
  await page.getByRole('link', { name: '← Volver al curso' }).click();
  await expect(page.getByRole('heading', { name: 'Dominio por competencia' })).toBeVisible();
  await expect(page.getByRole('table', { name: /Estado de dominio por competencia/ })).toBeVisible();
  await expect(page.getByText('Progreso del curso')).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, '06-course');

  // 11. Library, progress, profile
  await page.goto('/#/cursos');
  await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Continuar/ })).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, '07-library');

  await page.goto('/#/progreso');
  await expect(page.getByRole('heading', { name: 'Tu progreso' })).toBeVisible();
  await expect(page.getByText('Historial reciente')).toBeVisible();
  await shot(page, '08-progress');

  await page.goto('/#/perfil');
  await expect(page.getByLabel(/Nombre/)).toHaveValue('Lucía Pérez');
  await noHorizontalScroll(page);
  await shot(page, '09-profile');

  // 12. Coming back: dashboard remembers
  await page.goto('/#/');
  await expect(page.getByText(/La última vez/)).toBeVisible();
  await shot(page, '10-dashboard');

  // 13. Session persists across reloads
  await page.reload();
  await expect(page.getByText(/La última vez/)).toBeVisible();

  expect(errors).toEqual([]);
});

test('diagnosis asks only what is missing', async ({ page }) => {
  await page.goto('/#/registro');
  await page.getByLabel('Correo electrónico').fill(`d${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`);
  await page.getByLabel('Contraseña').fill('contraseña-segura-1');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('¿Qué quieres aprender o conseguir?').fill('fotografía');
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByText('Diagnóstico rápido')).toBeVisible({ timeout: 30_000 });
  const questions = page.locator('fieldset');
  expect(await questions.count()).toBeLessThanOrEqual(3);
  await noHorizontalScroll(page);
  await shot(page, '11-diagnosis');
  await questions.first().getByRole('button').first().click();
  await page.getByRole('button', { name: 'Crear mi plan' }).click();
  await expect(page.getByText('Qué podrás hacer al terminar')).toBeVisible({ timeout: 30_000 });
});

test('unauthenticated users are sent to login for private screens', async ({ page }) => {
  await page.goto('/#/cursos');
  await expect(page.getByRole('heading', { name: 'Entra a CursoAI' })).toBeVisible();
  await page.getByLabel('Correo electrónico').fill('nadie@example.com');
  await page.getByLabel('Contraseña').fill('incorrecta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText(/Correo o contraseña incorrectos/);
});

test('evaluation, final project and certificate screens', async ({ page }) => {
  await page.goto('/#/registro');
  await page.getByLabel('Nombre').fill('Mario Ruiz');
  await page.getByLabel('Correo electrónico').fill(`c${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`);
  await page.getByLabel('Contraseña').fill('contraseña-segura-1');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('¿Qué quieres aprender o conseguir?').first()).toBeVisible();

  // Set up and progress the course through the API with the same session cookie.
  const api = page.request;
  const origin = new URL(page.url()).origin;
  const h = { headers: { Origin: origin } };
  const created = await (await api.post('/api/courses', { data: { request: 'Quiero aprender Excel para conseguir trabajo' }, ...h })).json();
  const id = created.course_id;
  await api.post(`/api/courses/${id}/plan`, { data: {}, ...h });
  await api.post(`/api/courses/${id}/plan/accept`, { data: {}, ...h });

  // Practice exam through the UI
  await page.goto(`/#/curso/${id}`);
  await page.getByRole('button', { name: 'Hazme un examen' }).click();
  await expect(page.getByText('Examen de práctica', { exact: true })).toBeVisible({ timeout: 30_000 });
  const items = page.locator('main ol > li');
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const item = items.nth(i);
    if (await item.getByRole('radio', { name: 'Falso' }).count()) await item.getByRole('radio', { name: 'Falso' }).click();
    else if (await item.getByRole('radio').count()) await item.getByRole('radio').first().check();
    else await item.getByLabel('Tu respuesta').fill('Es un elemento clave para resolver tareas concretas, por ejemplo organizar información del trabajo.');
  }
  await page.getByRole('button', { name: 'Enviar evaluación' }).click();
  await expect(page.getByText(/Aprobado/)).toBeVisible({ timeout: 30_000 });
  await noHorizontalScroll(page);
  await shot(page, '12-quiz-result');

  // Walk the rest of the course via API (answers keyed to the deterministic mock).
  const answerFor = (k: string) =>
    k === 'multiple_choice' ? '0' : k === 'true_false' ? 'false' : 'Es un elemento clave para resolver tareas concretas, por ejemplo organizar información del trabajo.';
  for (let i = 0; i < 60; i++) {
    const next = await (await api.get(`/api/courses/${id}/next`)).json();
    if (next.kind === 'lesson') {
      const lesson = await (await api.get(`/api/lessons/${next.lesson_id}`)).json();
      for (const ex of lesson.exercises) await api.post(`/api/exercises/${ex.id}/answer`, { data: { response: answerFor(ex.kind) }, ...h });
      await api.post(`/api/lessons/${next.lesson_id}/complete`, { data: {}, ...h });
    } else if (next.kind === 'quiz') {
      const quiz = await (await api.get(`/api/quizzes/${next.quiz_id}`)).json();
      const answers = Object.fromEntries(quiz.questions.map((q: { id: string; kind: string }) => [q.id, answerFor(q.kind)]));
      await api.post(`/api/quizzes/${next.quiz_id}/submit`, { data: { answers }, ...h });
    } else break;
  }

  // Final project through the UI
  await page.goto(`/#/curso/${id}/proyecto`);
  await expect(page.getByText('Cómo se evaluará')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Tu entrega').fill(
    'Problema: controlar el presupuesto de la oficina. Solución: hoja con columnas de concepto, categoría y monto; SUMA y PROMEDIO por categoría, SI para marcar excesos y un gráfico. Reflexión: agregaría validación de datos y una tabla dinámica.',
  );
  await page.getByRole('button', { name: 'Enviar para evaluación' }).click();
  await expect(page.getByText('¡Proyecto aprobado!')).toBeVisible({ timeout: 30_000 });
  await shot(page, '13-project');
  await page.getByRole('button', { name: 'Obtener certificado' }).click();

  // Certificate
  await expect(page.getByText('Certificado de finalización', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Mario Ruiz' })).toBeVisible();
  await expect(page.getByText(/No es un título, diploma ni acreditación oficial/)).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, '14-certificate');

  // Public verification without a session
  const url = page.url();
  await page.context().clearCookies();
  await page.goto(url);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mario Ruiz' })).toBeVisible();
});
