// Entrada unificada: teclado + ratón (PC), controles táctiles (móvil) y gamepad.

export type Action = 'interact' | 'flashlight' | 'inventory' | 'journal' | 'map' | 'chat' | 'social' | 'shop' | 'escape' | 'season';

const KEYMAP: Record<string, Action> = {
  KeyE: 'interact',
  KeyF: 'flashlight',
  KeyI: 'inventory',
  KeyJ: 'journal',
  KeyM: 'map',
  Enter: 'chat',
  KeyT: 'chat',
  KeyP: 'social',
  KeyB: 'shop',
  KeyV: 'season',
  Escape: 'escape',
};

export class Input {
  move = { x: 0, y: 0 };
  run = false;
  private keys = new Set<string>();
  private cam = { x: 0, y: 0 };
  private zoom = 0;
  private actions = new Set<Action>();
  /** Movimiento desde el joystick táctil (0..1) */
  touchMove = { x: 0, y: 0 };
  enabled = true;
  sensitivity = 1;
  invertY = false;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private padPrev: boolean[] = [];
  usingGamepad = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (this.isTyping(e)) return;
      if (e.code === 'Tab') e.preventDefault();
      this.keys.add(e.code);
      const a = KEYMAP[e.code];
      if (a && !e.repeat) this.actions.add(a);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging || e.pointerType !== 'mouse') return;
      this.addCamera(e.clientX - this.lastX, e.clientY - this.lastY);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    const stop = () => (this.dragging = false);
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => (this.zoom += Math.sign(e.deltaY)), { passive: true });
  }

  private isTyping(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  addCamera(dx: number, dy: number) {
    this.cam.x += dx * this.sensitivity;
    this.cam.y += dy * this.sensitivity * (this.invertY ? -1 : 1);
  }

  press(a: Action) {
    this.actions.add(a);
  }

  /** Llamar una vez por fotograma. */
  poll() {
    let x = 0;
    let y = 0;
    if (this.enabled) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    }
    this.run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    x += this.touchMove.x;
    y += this.touchMove.y;
    const tl = Math.hypot(this.touchMove.x, this.touchMove.y);
    if (tl > 0.85) this.run = true;
    this.pollGamepad((gx, gy, run) => {
      x += gx;
      y += gy;
      if (run) this.run = true;
    });
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.move.x = x;
    this.move.y = y;
  }

  private pollGamepad(cb: (x: number, y: number, run: boolean) => void) {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) return;
    const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
    const lx = dz(gp.axes[0] ?? 0);
    const ly = dz(gp.axes[1] ?? 0);
    const rx = dz(gp.axes[2] ?? 0);
    const ry = dz(gp.axes[3] ?? 0);
    if (lx || ly || rx || ry) this.usingGamepad = true;
    cb(lx, -ly, Math.hypot(lx, ly) > 0.9 || !!gp.buttons[10]?.pressed);
    this.addCamera(rx * 9, ry * 6);
    const map: [number, Action][] = [
      [0, 'interact'],
      [1, 'escape'],
      [2, 'flashlight'],
      [3, 'journal'],
      [4, 'inventory'],
      [5, 'map'],
      [8, 'social'],
      [9, 'escape'],
    ];
    for (const [i, a] of map) {
      const pressed = !!gp.buttons[i]?.pressed;
      if (pressed && !this.padPrev[i]) this.actions.add(a);
      this.padPrev[i] = pressed;
    }
  }

  consumeCamera() {
    const c = { ...this.cam };
    this.cam.x = this.cam.y = 0;
    return c;
  }

  consumeZoom() {
    const z = this.zoom;
    this.zoom = 0;
    return z;
  }

  consumeActions(): Set<Action> {
    const a = new Set(this.actions);
    this.actions.clear();
    return a;
  }
}
