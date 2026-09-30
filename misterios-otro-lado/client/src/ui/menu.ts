import { GAME_NAME } from '../../../shared/constants';
import { HAIR_STYLES, type Appearance } from '../../../shared/protocol';
import type { Game } from '../game/Game';
import { api, ApiError, session } from '../net/api';
import { store } from '../state';
import { tg } from '../telegram';
import { clear, h } from './dom';

const SKIN = ['#f1d3b8', '#e0b894', '#c69c7b', '#a57655', '#7d5438', '#5a3a26'];
const HAIR = ['#1b1512', '#3b2a1f', '#6b4a2e', '#a67c4e', '#d9c9a8', '#8a8a8a', '#6b2f2a'];
const COAT = ['#3d3a33', '#4a4a42', '#2f3a44', '#4b3a2e', '#5a2f2f', '#2f4034', '#6b6254'];
const PANTS = ['#1f1f1f', '#2a2a2a', '#2b3440', '#3a3026', '#44403a'];

export function loading(root: HTMLElement, text = 'Cargando…', sponsor?: { headline: string; subline: string; sponsor: string; bg: string; fg: string }) {
  clear(root);
  root.append(
    h(
      'div',
      { class: 'loading' },
      h('div', { class: 'title' }, GAME_NAME),
      h('div', { class: 'muted' }, text),
      h('div', { class: 'bar' }, h('div')),
      sponsor
        ? h('div', { style: `margin-top:24px;padding:12px 18px;border-radius:10px;background:${sponsor.bg};color:${sponsor.fg};text-align:center;max-width:320px` },
            h('div', { class: 'small', style: 'opacity:.7;letter-spacing:.1em;text-transform:uppercase' }, 'Patrocinado por ', sponsor.sponsor),
            h('div', { style: 'font-size:18px;margin-top:4px' }, sponsor.headline),
            sponsor.subline ? h('div', { class: 'small', style: 'opacity:.85' }, sponsor.subline) : null)
        : null,
    ),
  );
}

function header() {
  return [h('h1', { class: 'title' }, 'Misterios'), h('div', { class: 'subtitle' }, 'El Otro Lado')];
}

/** Pantalla de acceso. Resuelve cuando hay sesión válida. */
export function authScreen(root: HTMLElement, game: Game): Promise<void> {
  return new Promise((resolve) => {
    const params = new URLSearchParams(location.search);
    const resetToken = params.get('reset');
    const verifyToken = params.get('verify');
    const refCode = params.get('ref');
    let tab: 'login' | 'register' | 'forgot' | 'reset' = resetToken ? 'reset' : refCode ? 'register' : 'login';

    const render = () => {
      clear(root);
      const err = h('div', { class: 'error-text' });
      const info = h('div', { class: 'muted small' });
      const unlock = () => game.audio.unlock();
      const tabs = h(
        'div',
        { class: 'tabs' },
        h('button', { class: tab === 'login' ? 'active' : '', onclick: () => ((tab = 'login'), render()) }, 'Entrar'),
        h('button', { class: tab === 'register' ? 'active' : '', onclick: () => ((tab = 'register'), render()) }, 'Crear cuenta'),
      );
      let form: HTMLElement;
      if (tab === 'login') {
        const login = h('input', { class: 'input', placeholder: 'Correo o usuario', autocomplete: 'username', maxlength: 254 });
        const pass = h('input', { class: 'input', type: 'password', placeholder: 'Contraseña', autocomplete: 'current-password', maxlength: 128 });
        const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Entrar al pueblo');
        form = h(
          'form',
          {
            class: 'col',
            onsubmit: async (e: Event) => {
              e.preventDefault();
              unlock();
              btn.setAttribute('disabled', '');
              err.textContent = '';
              try {
                const r = await api<{ token: string }>('POST', '/api/auth/login', { login: login.value, password: pass.value, deviceId: session.deviceId });
                session.token = r.token;
                resolve();
              } catch (e2) {
                err.textContent = (e2 as Error).message;
                btn.removeAttribute('disabled');
              }
            },
          },
          login,
          pass,
          err,
          btn,
          h('button', { class: 'btn ghost small', type: 'button', onclick: () => ((tab = 'forgot'), render()) }, '¿Olvidaste tu contraseña?'),
        );
      } else if (tab === 'register') {
        const email = h('input', { class: 'input', type: 'email', placeholder: 'Correo electrónico', autocomplete: 'email', maxlength: 254 });
        const user = h('input', { class: 'input', placeholder: 'Usuario (3-20: letras, números, _)', autocomplete: 'username', maxlength: 20 });
        const pass = h('input', { class: 'input', type: 'password', placeholder: 'Contraseña (mín. 8, letras y números)', autocomplete: 'new-password', maxlength: 128 });
        const ref = h('input', { class: 'input', placeholder: 'Código de invitación (opcional)', maxlength: 16, value: refCode ?? '' });
        const terms = h('input', { type: 'checkbox' });
        const age = h('input', { type: 'checkbox' });
        const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Crear cuenta');
        form = h(
          'form',
          {
            class: 'col',
            onsubmit: async (e: Event) => {
              e.preventDefault();
              unlock();
              err.textContent = '';
              btn.setAttribute('disabled', '');
              try {
                const r = await api<{ token: string }>('POST', '/api/auth/register', {
                  email: email.value,
                  username: user.value,
                  password: pass.value,
                  referralCode: ref.value.trim() || null,
                  deviceId: session.deviceId,
                  acceptTerms: terms.checked,
                  ageConfirmed: age.checked,
                });
                session.token = r.token;
                resolve();
              } catch (e2) {
                err.textContent = (e2 as Error).message;
                btn.removeAttribute('disabled');
              }
            },
          },
          email,
          user,
          pass,
          ref,
          h('label', { class: 'check' }, terms, h('span', null, 'Acepto los términos de uso y el aviso de privacidad (borrador del MVP).')),
          h('label', { class: 'check' }, age, h('span', null, 'Confirmo que tengo la edad mínima requerida en mi país para jugar en línea.')),
          err,
          btn,
        );
      } else if (tab === 'forgot') {
        const email = h('input', { class: 'input', type: 'email', placeholder: 'Correo de tu cuenta', maxlength: 254 });
        form = h(
          'form',
          {
            class: 'col',
            onsubmit: async (e: Event) => {
              e.preventDefault();
              try {
                const r = await api<{ message: string; sandboxMail: boolean }>('POST', '/api/auth/forgot', { email: email.value });
                info.textContent = r.message + (r.sandboxMail ? ' (Modo sandbox: el enlace se muestra en la consola del servidor.)' : '');
              } catch (e2) {
                err.textContent = (e2 as Error).message;
              }
            },
          },
          h('p', { class: 'muted small' }, 'Te enviaremos un enlace para restablecer la contraseña.'),
          email,
          err,
          info,
          h('button', { class: 'btn primary block', type: 'submit' }, 'Enviar enlace'),
          h('button', { class: 'btn ghost small', type: 'button', onclick: () => ((tab = 'login'), render()) }, 'Volver'),
        );
      } else {
        const pass = h('input', { class: 'input', type: 'password', placeholder: 'Nueva contraseña', autocomplete: 'new-password', maxlength: 128 });
        form = h(
          'form',
          {
            class: 'col',
            onsubmit: async (e: Event) => {
              e.preventDefault();
              try {
                await api('POST', '/api/auth/reset', { token: resetToken, password: pass.value });
                history.replaceState(null, '', location.pathname);
                tab = 'login';
                render();
                info.textContent = 'Contraseña actualizada. Ya puedes entrar.';
              } catch (e2) {
                err.textContent = (e2 as Error).message;
              }
            },
          },
          h('p', { class: 'muted small' }, 'Escribe tu nueva contraseña.'),
          pass,
          err,
          h('button', { class: 'btn primary block', type: 'submit' }, 'Guardar contraseña'),
        );
      }
      const sandbox = store.config?.sandbox ? h('div', { class: 'notice-box small', style: 'margin-top:12px' }, 'MODO SANDBOX · Compras, anuncios y canjes son simulados. No se cobra ni se paga dinero real.') : null;
      root.append(
        h(
          'div',
          { class: 'menu-wrap' },
          h(
            'div',
            { class: 'menu-card' },
            ...header(),
            h('p', { class: 'muted small', style: 'margin-top:-6px' }, 'Hace treinta años, una familia desapareció en San Bartolo del Monte. Esta noche, alguien encendió una luz en la casa de la colina.'),
            tab === 'login' || tab === 'register' ? tabs : null,
            form,
            info,
            sandbox,
          ),
        ),
      );
    };

    if (verifyToken) {
      api('POST', '/api/auth/verify', { token: verifyToken })
        .then(() => alert('Correo verificado. ¡Gracias!'))
        .catch((e: ApiError) => alert(e.message))
        .finally(() => history.replaceState(null, '', location.pathname));
    }
    render();
  });
}

/** Creación de personaje con vista previa 3D. */
export function characterScreen(root: HTMLElement, game: Game): Promise<void> {
  return new Promise((resolve) => {
    const app: Appearance = { skin: SKIN[2], hair: HAIR[1], coat: COAT[0], pants: PANTS[0], hairStyle: 'short', beard: false };
    game.showPreview(app);
    const err = h('div', { class: 'error-text' });
    const name = h('input', { class: 'input', placeholder: 'Nombre de tu investigador', maxlength: 20, value: (tg.firstName ?? '').replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ._-]/g, '').slice(0, 20) });
    const row = (label: string, key: keyof Appearance, colors: string[]) => {
      const wrap = h('div', { class: 'swatches' });
      const draw = () => {
        clear(wrap);
        for (const c of colors) {
          wrap.append(
            h('button', {
              type: 'button',
              class: `swatch ${app[key] === c ? 'active' : ''}`,
              style: `background:${c}`,
              'aria-label': `${label} ${c}`,
              onclick: () => {
                (app as unknown as Record<string, string>)[key] = c;
                game.showPreview(app);
                draw();
              },
            }),
          );
        }
      };
      draw();
      return h('div', { class: 'col', style: 'gap:4px' }, h('span', { class: 'muted small' }, label), wrap);
    };
    const styleRow = () => {
      const wrap = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px' });
      const labels: Record<string, string> = { short: 'Corto', long: 'Largo', bun: 'Recogido', bald: 'Rapado' };
      const draw = () => {
        clear(wrap);
        for (const st of HAIR_STYLES) {
          wrap.append(h('button', { type: 'button', class: `btn small ${app.hairStyle === st ? 'primary' : 'ghost'}`, onclick: () => ((app.hairStyle = st), game.showPreview(app), draw()) }, labels[st]));
        }
        wrap.append(h('button', { type: 'button', class: `btn small ${app.beard ? 'primary' : 'ghost'}`, onclick: () => ((app.beard = !app.beard), game.showPreview(app), draw()) }, app.beard ? 'Con barba' : 'Sin barba'));
      };
      draw();
      return h('div', { class: 'col', style: 'gap:4px' }, h('span', { class: 'muted small' }, 'Peinado'), wrap);
    };
    const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Comenzar la investigación');
    clear(root);
    root.append(
      h(
        'div',
        { class: 'menu-wrap', style: 'justify-content:flex-start;background:linear-gradient(90deg, rgba(5,6,8,.85), rgba(5,6,8,.1) 60%)' },
        h(
          'form',
          {
            class: 'menu-card col',
            onsubmit: async (e: Event) => {
              e.preventDefault();
              btn.setAttribute('disabled', '');
              err.textContent = '';
              try {
                await api('POST', '/api/characters', { name: name.value, appearance: app });
                resolve();
              } catch (e2) {
                err.textContent = (e2 as Error).message;
                btn.removeAttribute('disabled');
              }
            },
          },
          h('h2', { class: 'title', style: 'font-size:28px' }, 'Tu investigador'),
          h('p', { class: 'muted small' }, 'Podrás cambiar su ropa y accesorios más adelante con cosméticos.'),
          name,
          row('Piel', 'skin', SKIN),
          row('Cabello', 'hair', HAIR),
          styleRow(),
          row('Abrigo', 'coat', COAT),
          row('Pantalón', 'pants', PANTS),
          err,
          btn,
        ),
      ),
    );
  });
}
